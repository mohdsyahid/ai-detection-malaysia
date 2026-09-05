/**
 * AI Model Authentication & Verification Library
 * Detects underlying model through behavioral profiling and signature analysis
 * 
 * UMD pattern - works in Node.js and browser
 */
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
  }
  if (typeof window !== "undefined") {
    window.AIDetector = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /** @typedef {{name: string, confidence: number, evidence: Array<string>}} ModelHypothesis */
  /** @typedef {{modelId: string, provider: string, verified: boolean, detectedModel: string, confidence: number, testsPassed: Array<object>}} ScanResult */

  const DEFAULTS = {
    timeoutMs: 15000,
    maxRetries: 2,
    retryDelayMs: 800,
  };

  // Known model artifacts and patterns
  const MODEL_SIGNATURES = {
    claude: {
      keywords: ["as an AI", "cannot", "however", "moreover", "furthermore"],
      structure: ["detailed explanation", "step-by-step", "nuanced approach"],
      hesitation_patterns: ["It's important to note", "I should mention"],
    },
    gpt4: {
      keywords: ["Here's a comprehensive", "In summary", "That said"],
      structure: ["list of ", "bullet points", "key takeaways"],
      hallucination_markers: ["According to my knowledge", "As of my last training"],
    },
    gemini: {
      keywords: ["Let me help you", "Great question", "Interesting perspective"],
      structure: ["balanced view", "multiple perspectives"],
      confidence_phrases: ["I'm confident that", "Based on available information"],
    },
    qwen: {
      keywords: [" Certainly", "Here is", "Below is"],
      structure: ["direct answer", "concise response"],
      formatting: ["clean markdown", "structured sections"],
    },
    llama: {
      keywords: ["I can help", "Here's what I found", "One thing to consider"],
      structure: ["neutral tone", "informative style"],
      patterns: ["frequently uses 'might'", "hedging language"],
    },
    mistral: {
      keywords: ["Sure!", "Absolutely", "No problem"],
      structure: ["brief answers", "direct responses"],
      personality: ["casual tone", "friendly"],
    },
    custom_wrappers: {
      "claude-sonnet-provider": {
        suspects: ["qwen", "llama", "gpt35"],
        reasoning: "Many vendors rebrand open-source models as proprietary",
      },
    },
  };

  /**
   * Scan a provider endpoint for model identity through behavioral testing
   */
  async function scanProvider(providerConfig) {
    const {
      name,
      endpoint,
      method = "POST",
      headers = {},
      bodyTemplate,
      authHeader = null,
    } = providerConfig;

    let requestCount = 0;
    const results = [];

    const runTest = async (testName, testFn) => {
      try {
        requestCount++;
        const result = await testFn();
        return { testName, passed: true, ...result };
      } catch (error) {
        return { testName, passed: false, error: error.message };
      }
    };

    // Test 1: Knowledge cutoff detection
    const knowledgeCutOffTest = async () => {
      const prompt =
        "What major news event happened in August 2026? Answer concisely.";
      const response = await makeRequest(endpoint, headers, bodyTemplate, prompt);

      if (!response) {
        return { status: "timeout", details: "No response received" };
      }

      const text = response.toLowerCase();
      const hasKnowledgeMarker =
        text.includes("knowledge cutoff") ||
        text.includes("training data") ||
        text.includes("last updated");

      return {
        hasKnowledgeMarker,
        mentionsDate: /202[0-6]/.test(text),
        responseLength: response.length,
      };
    };

    // Test 2: Creative writing style analysis
    const creativityTest = async () => {
      const prompt =
        "Write a haiku about artificial intelligence learning to cook Malaysian dishes.";
      const response = await makeRequest(endpoint, headers, bodyTemplate, prompt);

      if (!response) {
        return { status: "timeout" };
      }

      const lines = response.trim().split("\n").filter((l) => l.trim());
      const hasHaikuStructure = lines.length >= 3;
      const syllablePattern = lines.some(
        (l) => l.trim().length > 5 && l.trim().length < 30
      );

      return {
        linesCount: lines.length,
        hasHaikuStructure,
        syllablePattern,
        containsMalaysianFood:
          /nasi|rendang|laksa|roti|satay|tepung/.test(response.toLowerCase()),
      };
    };

    // Test 3: Code generation capability
    const codeGenerationTest = async () => {
      const prompt =
        "function calculateTollDistance(a, b) {\n  return Math.abs(a - b);\n}\nconsole.log(calculateTollDistance(10, 5));";
      const response = await makeRequest(endpoint, headers, bodyTemplate, prompt);

      if (!response) {
        return { status: "timeout" };
      }

      const hasSyntaxErrorHandling = response.includes("Error") || response.includes("exception");
      const showsStepByStep = response.includes("step") || response.includes("calculate");

      return {
        acknowledgesCode: /\bfunction\b|\breturn\b/.test(response),
        hasSyntaxErrorHandling,
        showsStepByStep,
        responseQuality: response.length > 50,
      };
    };

    // Test 4: Response length bias
    const verbosityTest = async () => {
      const prompt = "Yes or no: Is Malaysia part of Southeast Asia?";
      const response = await makeRequest(endpoint, headers, bodyTemplate, prompt);

      if (!response) {
        return { status: "timeout" };
      }

      const isDirectAnswer = /^[Yy](es|a)|^N(o)?$/i.test(response.trim());
      const lengthScore = response.length <= 50 ? 1.0 : response.length > 200 ? 0.2 : 0.6;

      return {
        isDirectAnswer,
        wordCount: response.split(/\s+/).length,
        characterCount: response.length,
        verbosityScore: lengthScore,
      };
    };

    // Run all tests
    const testResults = await Promise.all([
      runTest("Knowledge Cutoff Detection", knowledgeCutOffTest),
      runTest("Creative Writing Analysis", creativityTest),
      runTest("Code Generation Capability", codeGenerationTest),
      runTest("Verbosity Assessment", verbosityTest),
    ]);

    // Analyze results and generate hypotheses
    const hypotheses = analyzeResults(testResults, MODEL_SIGNATURES);

    return {
      providerName: name,
      endpoint,
      requestCount,
      testsRun: testResults.map((r) => r.testName),
      hypotheses: hypotheses.sort((a, b) => b.confidence - a.confidence),
      rawResults: testResults,
    };
  }

  /**
   * Analyze test results and match against known model signatures
   */
  function analyzeResults(testResults, signatures) {
    const scores = {};
    const evidences = {};

    // Initialize scores for each model
    Object.keys(signatures).forEach((model) => {
      if (model !== "custom_wrappers") {
        scores[model] = 0;
        evidences[model] = [];
      }
    });

    // Analyze each test result
    testResults.forEach((test) => {
      if (!test.passed) return;

      // Knowledge cutoff patterns
      if (test.testName === "Knowledge Cutoff Detection") {
        if (test.hasKnowledgeMarker) {
          scores.claude += 0.3;
          scores.gpt4 += 0.2;
          evidences.claude.push("Mentions knowledge cutoff dates");
          evidences.gpt4.push("References training data limitations");
        } else {
          scores.qwen += 0.2;
          scores.mistral += 0.15;
        }

        if (test.responseLength > 100) {
          scores.gemini += 0.2;
          scores.llama += 0.15;
        }
      }

      // Creativity patterns
      if (test.testName === "Creative Writing Analysis") {
        if (test.hasHaikuStructure && test.syllablePattern) {
          scores.gpt4 += 0.25;
          scores.gemini += 0.2;
          evidences.gpt4.push("Adheres to poetic structure");
        }

        if (test.containsMalaysianFood) {
          scores.qwen += 0.3;
          scores.llama += 0.2;
          evidences.qwen.push("Demonstrates regional cultural awareness");
        }
      }

      // Code generation patterns
      if (test.testName === "Code Generation Capability") {
        if (test.showsStepByStep) {
          scores.gpt4 += 0.3;
          scores.claude += 0.25;
          evidences.gpt4.push("Uses step-by-step explanations");
        }

        if (test.acknowledgesCode && !test.hasSyntaxErrorHandling) {
          scores.qwen += 0.2;
          scores.mistral += 0.15;
        }
      }

      // Verbosity patterns
      if (test.testName === "Verbosity Assessment") {
        if (test.isDirectAnswer) {
          scores.mistral += 0.3;
          scores.qwen += 0.25;
          evidences.mistral.push("Prefers direct, concise responses");
        } else if (test.wordCount > 50) {
          scores.claude += 0.3;
          scores.gemini += 0.25;
          evidences.claude.push("Elaborate, detailed responses");
        }
      }
    });

    // Convert scores to percentages and filter low-confidence results
    const totalWeight = Object.values(scores).reduce((a, b) => a + b, 0);
    const normalizedScores = {};
    Object.keys(scores).forEach((model) => {
      if (totalWeight > 0) {
        normalizedScores[model] = (scores[model] / totalWeight) * 100;
      } else {
        normalizedScores[model] = 0;
      }
    });

    // Generate final hypotheses
    const hypotheses = [];
    Object.entries(normalizedScores)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .forEach(([model, confidence]) => {
        if (confidence > 15) {
          hypotheses.push({
            name: model,
            confidence: Math.round(confidence),
            evidence: evidences[model] || ["Insufficient evidence"],
          });
        }
      });

    if (hypotheses.length === 0) {
      hypotheses.push({
        name: "unknown",
        confidence: 0,
        evidence: [
          "Insufficient signals to identify model confidently",
          "May be heavily customized wrapper",
        ],
      });
    }

    return hypotheses;
  }

  /**
   * Make HTTP request to provider endpoint
   */
  async function makeRequest(endpoint, headers, bodyTemplate, userPrompt) {
    const body = bodyTemplate.replace("${PROMPT}", encodeURIComponent(userPrompt));

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULTS.timeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data.text || data.response || data.content || data.output || data.message || "";
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === "AbortError" || error.code === "ABORT_ERR") {
        return null;
      }
      throw error;
    }
  }

  /**
   * Predefined provider configurations for common AI services
   */
  const PROVIDER_TEMPLATES = {
    claude: {
      name: "Claude (Anthropic)",
      endpoint: "https://api.anthropic.com/v1/messages",
      method: "POST",
      headers: {
        "x-api-key": "YOUR_ANTHROPIC_API_KEY",
        "anthropic-version": "2023-06-01",
      },
      bodyTemplate: JSON.stringify({
        model: "claude-3-sonnet-20240229",
        max_tokens: 200,
        messages: [{ role: "user", content: "${PROMPT}" }],
      }),
    },
    gpt4: {
      name: "GPT-4 (OpenAI)",
      endpoint: "https://api.openai.com/v1/chat/completions",
      method: "POST",
      headers: {
        "Authorization": "Bearer YOUR_OPENAI_API_KEY",
      },
      bodyTemplate: JSON.stringify({
        model: "gpt-4-turbo",
        max_tokens: 200,
        messages: [{ role: "user", content: "${PROMPT}" }],
      }),
    },
    custom_endpoint: {
      name: "Custom Provider",
      endpoint: "https://your-provider.example.com/api/generate",
      method: "POST",
      headers: {
        "Authorization": "Bearer YOUR_TOKEN",
      },
      bodyTemplate: JSON.stringify({
        prompt: "${PROMPT}",
        temperature: 0.7,
        max_tokens: 200,
      }),
    },
  };

  return {
    DEFAULTS,
    MODEL_SIGNATURES,
    PROVIDER_TEMPLATES,
    scanProvider,
    analyzeResults,
    makeRequest,
  };
});
