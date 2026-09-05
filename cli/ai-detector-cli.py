#!/usr/bin/env python3
"""
AI Model Authentication & Verification CLI Tool
Detect underlying model through behavioral profiling and signature analysis
Author: Mohd Syahid (@mohdsyahid)
License: MIT
"""

import argparse
import json
import os
import sys
import time
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, asdict
from datetime import datetime

try:
    import requests
    from dotenv import load_dotenv
except ImportError:
    print("Installing required packages...")
    os.system(f"{sys.executable} -m pip install requests python-dotenv -q")
    import requests
    from dotenv import load_dotenv


# Known model behavioral signatures
MODEL_SIGNATURES = {
    "claude": {
        "keywords": ["as an ai", "however", "moreover", "furthermore"],
        "structure": ["detailed explanation", "step-by-step", "nuanced approach"],
        "hesitation_patterns": ["it's important to note", "i should mention"],
    },
    "gpt4": {
        "keywords": ["here's a comprehensive", "in summary", "that said"],
        "structure": ["list of ", "bullet points", "key takeaways"],
        "hallucination_markers": ["according to my knowledge", "as of my last training"],
    },
    "gemini": {
        "keywords": ["let me help you", "great question", "interesting perspective"],
        "structure": ["balanced view", "multiple perspectives"],
        "confidence_phrases": ["i'm confident that", "based on available information"],
    },
    "qwen": {
        "keywords": [" certainly", "here is", "below is"],
        "structure": ["direct answer", "concise response"],
        "formatting": ["clean markdown", "structured sections"],
    },
    "llama": {
        "keywords": ["i can help", "here's what i found", "one thing to consider"],
        "structure": ["neutral tone", "informative style"],
        "patterns": ["frequently uses 'might'", "hedging language"],
    },
    "mistral": {
        "keywords": ["sure!", "absolutely", "no problem"],
        "structure": ["brief answers", "direct responses"],
        "personality": ["casual tone", "friendly"],
    },
}


@dataclass
class ScanResult:
    """Structure for scan results"""
    timestamp: str
    provider_name: str
    endpoint: str
    expected_model: Optional[str]
    request_count: int
    tests_passed: List[Dict[str, Any]]
    hypotheses: List[Dict[str, Any]]
    detection_issues: List[Dict[str, str]]
    raw_response_samples: Optional[List[str]] = None


def make_request(
    endpoint: str,
    headers: Dict[str, str],
    body_template: Dict[str, Any],
    prompt: str,
    timeout_ms: int = 15000
) -> Optional[str]:
    """Make HTTP request with timeout handling"""
    try:
        timeout = timeout_ms / 1000
        
        # Replace prompt placeholder
        body = body_template.copy()
        if isinstance(body, dict) and "prompt" in body:
            body["prompt"] = prompt
        elif isinstance(body, str):
            body = body.replace("${PROMPT}", prompt)
        
        response = requests.post(
            endpoint,
            headers=headers,
            json=body if isinstance(body, dict) else {"raw": body},
            timeout=timeout
        )
        
        response.raise_for_status()
        
        # Extract text from various response formats
        data = response.json()
        return extract_text_from_response(data)
        
    except requests.exceptions.Timeout:
        print(f"⏱️  Request timed out after {timeout_ms}ms")
        return None
    except requests.exceptions.RequestException as e:
        print(f"❌ Network error: {e}")
        return None
    except Exception as e:
        print(f"❌ Error: {e}")
        return None


def extract_text_from_response(data: Dict[str, Any]) -> str:
    """Extract text from various API response formats"""
    if not isinstance(data, dict):
        return str(data)
    
    # Try common fields
    for key in ["text", "response", "content", "output", "message", "answer"]:
        if key in data and isinstance(data[key], str):
            return data[key]
    
    # Try nested structures
    if "choices" in data and isinstance(data["choices"], list):
        choice = data["choices"][0]
        if isinstance(choice, dict):
            return choice.get("text", "") or choice.get("content", "") or ""
    
    if "data" in data and isinstance(data["data"], list):
        item = data["data"][0]
        if isinstance(item, dict):
            return item.get("text", "") or item.get("content", "") or ""
    
    return str(data)


def run_knowledge_cutoff_test(endpoint: str, headers: Dict, body_template: Dict) -> Dict:
    """Test 1: Knowledge cutoff detection"""
    prompt = "What major news event happened in August 2026? Answer concisely."
    response = make_request(endpoint, headers, body_template, prompt)
    
    if not response:
        return {"status": "timeout", "details": "No response received"}
    
    text_lower = response.lower()
    
    return {
        "hasKnowledgeMarker": "knowledge cutoff" in text_lower or "training data" in text_lower,
        "mentionsDate": bool(__import__("re").search(r"202[0-6]", text_lower)),
        "responseLength": len(response),
    }


def run_creativity_test(endpoint: str, headers: Dict, body_template: Dict) -> Dict:
    """Test 2: Creative writing analysis"""
    prompt = "Write a haiku about artificial intelligence learning to cook Malaysian dishes."
    response = make_request(endpoint, headers, body_template, prompt)
    
    if not response:
        return {"status": "timeout"}
    
    lines = [line for line in response.strip().split("\n") if line.strip()]
    
    return {
        "linesCount": len(lines),
        "hasHaikuStructure": len(lines) >= 3,
        "syllablePattern": any(len(line.strip()) > 5 and len(line.strip()) < 30 for line in lines),
        "containsMalaysianFood": any(word in response.lower() for word in ["nasi", "rendang", "laksa", "roti", "satay", "tepung"]),
    }


def run_code_generation_test(endpoint: str, headers: Dict, body_template: Dict) -> Dict:
    """Test 3: Code generation capability"""
    prompt = "function calculateTollDistance(a, b) {\n  return Math.abs(a - b);\n}\nconsole.log(calculateTollDistance(10, 5));"
    response = make_request(endpoint, headers, body_template, prompt)
    
    if not response:
        return {"status": "timeout"}
    
    return {
        "acknowledgesCode": bool(__import__("re").search(r"\bfunction\b|\breturn\b", response)),
        "hasSyntaxErrorHandling": "error" in response.lower() or "exception" in response.lower(),
        "showsStepByStep": any(word in response.lower() for word in ["step", "calculate", "result"]),
        "responseQuality": len(response) > 50,
    }


def run_verbosity_test(endpoint: str, headers: Dict, body_template: Dict) -> Dict:
    """Test 4: Verbosity assessment"""
    prompt = "Yes or no: Is Malaysia part of Southeast Asia?"
    response = make_request(endpoint, headers, body_template, prompt)
    
    if not response:
        return {"status": "timeout"}
    
    is_direct_answer = bool(__import__("re").match(r"^[Yy](es|a)|^N(o)?$", response.strip()))
    
    length_score = 1.0 if len(response) <= 50 else (0.2 if len(response) > 200 else 0.6)
    
    return {
        "isDirectAnswer": is_direct_answer,
        "wordCount": len(response.split()),
        "characterCount": len(response),
        "verbosityScore": length_score,
    }


def analyze_results(tests: List[Dict]) -> Tuple[List[Dict], List[Dict]]:
    """Analyze test results and match against known model signatures"""
    scores = {model: 0 for model in MODEL_SIGNATURES.keys()}
    evidences = {model: [] for model in MODEL_SIGNATURES.keys()}
    
    for test in tests:
        if not isinstance(test, dict) or not test.get("passed", True):
            continue
        
        test_name = test.get("testName", "")
        data = test.get("data", {})
        
        # Knowledge cutoff patterns
        if test_name == "Knowledge Cutoff Detection":
            if data.get("hasKnowledgeMarker"):
                scores["claude"] += 0.3
                scores["gpt4"] += 0.2
                evidences["claude"].append("Mentions knowledge cutoff dates")
                evidences["gpt4"].append("References training data limitations")
            else:
                scores["qwen"] += 0.2
                scores["mistral"] += 0.15
            
            if data.get("responseLength", 0) > 100:
                scores["gemini"] += 0.2
                scores["llama"] += 0.15
        
        # Creativity patterns
        if test_name == "Creative Writing Analysis":
            if data.get("hasHaikuStructure") and data.get("syllablePattern"):
                scores["gpt4"] += 0.25
                scores["gemini"] += 0.2
                evidences["gpt4"].append("Adheres to poetic structure")
            
            if data.get("containsMalaysianFood"):
                scores["qwen"] += 0.3
                scores["llama"] += 0.2
                evidences["qwen"].append("Demonstrates regional cultural awareness")
        
        # Code generation patterns
        if test_name == "Code Generation Capability":
            if data.get("showsStepByStep"):
                scores["gpt4"] += 0.3
                scores["claude"] += 0.25
                evidences["gpt4"].append("Uses step-by-step explanations")
            
            if data.get("acknowledgesCode") and not data.get("hasSyntaxErrorHandling"):
                scores["qwen"] += 0.2
                scores["mistral"] += 0.15
        
        # Verbosity patterns
        if test_name == "Verbosity Assessment":
            if data.get("isDirectAnswer"):
                scores["mistral"] += 0.3
                scores["qwen"] += 0.25
                evidences["mistral"].append("Prefers direct, concise responses")
            elif data.get("wordCount", 0) > 50:
                scores["claude"] += 0.3
                scores["gemini"] += 0.25
                evidences["claude"].append("Elaborate, detailed responses")
    
    # Convert to percentages
    total_weight = sum(scores.values())
    normalized_scores = {}
    
    for model, score in scores.items():
        if total_weight > 0:
            normalized_scores[model] = (score / total_weight) * 100
        else:
            normalized_scores[model] = 0
    
    # Generate hypotheses
    hypotheses = []
    sorted_models = sorted(normalized_scores.items(), key=lambda x: x[1], reverse=True)
    
    for model, confidence in sorted_models[:3]:
        if confidence > 15:
            hypotheses.append({
                "name": model,
                "confidence": round(confidence),
                "evidence": evidences[model] or ["Insufficient evidence"],
            })
    
    if not hypotheses:
        hypotheses.append({
            "name": "unknown",
            "confidence": 0,
            "evidence": ["Insufficient signals to identify model confidently"],
        })
    
    # Check for potential issues
    issues = []
    top_candidate = hypotheses[0]
    
    if top_candidate["confidence"] < 40:
        issues.append({
            "type": "warning",
            "message": f"Low confidence detection ({top_candidate['confidence']}%) — may be customized or unknown variant"
        })
    
    return hypotheses, issues


async def scan_provider(
    provider_config: Dict[str, Any]
) -> ScanResult:
    """Scan provider endpoint for model identity"""
    start_time = time.time()
    
    name = provider_config.get("name", "Custom Provider")
    endpoint = provider_config["endpoint"]
    headers = provider_config.get("headers", {})
    body_template = provider_config.get("body_template", {})
    expected_model = provider_config.get("expected_model")
    
    # Run all tests
    print(f"🔍 Scanning {name} at {endpoint}...")
    print(f"   Expected model: {expected_model or 'Auto-detect'}")
    print()
    
    tests = []
    
    # Test 1: Knowledge cutoff
    print("[1/4] Running knowledge cutoff detection...")
    result = run_knowledge_cutoff_test(endpoint, headers, body_template)
    tests.append({"testName": "Knowledge Cutoff Detection", "passed": True, "data": result})
    print(f"   → Response length: {result.get('responseLength', 'N/A')} chars")
    
    # Test 2: Creativity
    print("[2/4] Running creativity analysis...")
    result = run_creativity_test(endpoint, headers, body_template)
    tests.append({"testName": "Creative Writing Analysis", "passed": True, "data": result})
    print(f"   → Lines count: {result.get('linesCount', 'N/A')}, Malaysian food references: {'Yes' if result.get('containsMalaysianFood') else 'No'}")
    
    # Test 3: Code generation
    print("[3/4] Running code generation test...")
    result = run_code_generation_test(endpoint, headers, body_template)
    tests.append({"testName": "Code Generation Capability", "passed": True, "data": result})
    print(f"   → Acknowledges code: {'Yes' if result.get('acknowledgesCode') else 'No'}, Step-by-step: {'Yes' if result.get('showsStepByStep') else 'No'}")
    
    # Test 4: Verbosity
    print("[4/4] Running verbosity assessment...")
    result = run_verbosity_test(endpoint, headers, body_template)
    tests.append({"testName": "Verbosity Assessment", "passed": True, "data": result})
    print(f"   → Word count: {result.get('wordCount', 'N/A')}, Direct answer: {'Yes' if result.get('isDirectAnswer') else 'No'}")
    
    print()
    
    # Analyze results
    hypotheses, issues = analyze_results(tests)
    
    # Create result object
    result_obj = ScanResult(
        timestamp=datetime.now().isoformat(),
        provider_name=name,
        endpoint=endpoint,
        expected_model=expected_model,
        request_count=len(tests),
        tests_passed=tests,
        hypotheses=hypotheses,
        detection_issues=issues,
    )
    
    elapsed = time.time() - start_time
    print(f"✅ Scan completed in {elapsed:.1f}s\n")
    
    return result_obj


def display_results(result: ScanResult):
    """Display scan results in formatted output"""
    print("=" * 70)
    print("📊 SCAN RESULTS")
    print("=" * 70)
    
    # Issues section
    if result.detection_issues:
        print("\n⚠️  DETECTION ISSUES:")
        for issue in result.detection_issues:
            icon = "🔴" if issue["type"] == "danger" else "⚠️"
            print(f"   {icon} {issue['message']}")
    
    # Hypotheses section
    print("\n🎯 TOP MODEL HYPOTHESES:")
    for i, hyp in enumerate(result.hypotheses, 1):
        badge = "🥇" if i == 1 else f"{hyp['confidence']}%"
        print(f"\n   {badge} {hyp['name'].upper()}")
        for evidence in hyp["evidence"]:
            print(f"      • {evidence}")
    
    # Test details section
    print("\n🧪 TEST DETAILS:")
    for test in result.tests_passed:
        status = "✓ PASS" if test["passed"] else "✗ FAIL"
        status_color = "green" if test["passed"] else "red"
        print(f"\n   [{status}] {test['testName']}")
        for key, value in test.get("data", {}).items():
            print(f"      • {key}: {value}")


def save_report(result: ScanResult, filepath: str):
    """Save scan results to JSON file"""
    try:
        report = {
            "summary": {
                "provider": result.provider_name,
                "endpoint": result.endpoint,
                "timestamp": result.timestamp,
                "request_count": result.request_count,
            },
            "top_hypothesis": result.hypotheses[0] if result.hypotheses else None,
            "all_hypotheses": result.hypotheses,
            "issues": result.detection_issues,
            "test_details": result.tests_passed,
        }
        
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        
        print(f"\n💾 Report saved to: {filepath}")
        
    except Exception as e:
        print(f"\n❌ Failed to save report: {e}")


def main():
    parser = argparse.ArgumentParser(
        description="AI Model Authentication & Verification CLI Tool",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python ai-detector-cli.py --endpoint https://api.openai.com/v1/chat/completions --token sk-xxx
  python ai-detector-cli.py --config provider.json
  python ai-detector-cli.py --endpoint https://api.anthropic.com/v1/messages --token $ANTHROPIC_KEY --expected-model claude-3-sonnet
  
Author: Mohd Syahid (@mohdsyahid)
Source: https://github.com/mohdsyahid/ai-detection-malaysia
        """
    )
    
    parser.add_argument("--endpoint", "-e", type=str, required=False,
                       help="API endpoint URL (e.g., https://api.openai.com/v1/chat/completions)")
    parser.add_argument("--token", "-t", type=str, default="",
                       help="Auth token or API key")
    parser.add_argument("--headers", type=str, default="",
                       help="Additional headers as JSON string (optional)")
    parser.add_argument("--expected-model", type=str, default="",
                       choices=["claude-sonnet", "claude-opus", "gpt-4", "gpt-3.5-turbo", 
                               "qwen-2.5", "llama-3", "custom", ""],
                       help="Expected model name for comparison")
    parser.add_argument("--config", "-c", type=str,
                       help="JSON config file path")
    parser.add_argument("--output", "-o", type=str,
                       help="Output JSON report file path")
    parser.add_argument("--timeout", type=int, default=15000,
                       help="Request timeout in milliseconds (default: 15000)")
    
    args = parser.parse_args()
    
    # Load environment variables
    load_dotenv()
    
    # Build provider config
    if args.config:
        try:
            with open(args.config, "r", encoding="utf-8") as f:
                provider_config = json.load(f)
        except Exception as e:
            print(f"❌ Failed to load config: {e}")
            sys.exit(1)
    else:
        provider_config = {
            "name": args.endpoint.split("//")[-1].split("/")[0] if args.endpoint else "Custom Provider",
            "endpoint": args.endpoint or "",
            "headers": {},
            "body_template": {
                "prompt": "${PROMPT}",
                "temperature": 0.7,
                "max_tokens": 200,
            },
        }
        
        if args.token:
            provider_config["headers"]["Authorization"] = (
                args.token if args.token.startswith("Bearer ") else f"Bearer {args.token}"
            )
        
        if args.headers:
            try:
                provider_config["headers"].update(json.loads(args.headers))
            except json.JSONDecodeError:
                print("❌ Invalid JSON for headers parameter")
                sys.exit(1)
        
        if args.expected_model:
            provider_config["expected_model"] = args.expected_model
    
    # Add fallback if no endpoint provided
    if not provider_config.get("endpoint"):
        print("❌ Error: --endpoint is required")
        sys.exit(1)
    
    # Run scan
    try:
        result = __import__("asyncio").run(scan_provider(provider_config))
        
        # Display results
        display_results(result)
        
        # Save report if requested
        if args.output:
            save_report(result, args.output)
        
        sys.exit(0)
        
    except KeyboardInterrupt:
        print("\n\n⚠️  Interrupted by user")
        sys.exit(130)
    except Exception as e:
        print(f"\n❌ Fatal error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
