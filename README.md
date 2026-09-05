# 🔍 AI Authentication Checker (Model Verification Tool)

> Check sama ada provider AI jual model yang sebenar atau sekadar rebrand/open-source wrapper. Detect underlying model melalui **behavioral profiling** dan **signature analysis**.

## 🎯 Masalah Yang Selesaikan

Banyak bank, fintech, dan corporate providers di Malaysia jual akses API dengan nama premium (contoh: "Claude Sonnet", "GPT-4"), tapi belakang tu kadang-kadang model lain (Qwen, Llama, dll). Tool ni membantu verify model identity sebelum kamu bayar untuk akses.

## ✨ Ciri-ciri Utama

- **Live Web Dashboard** — Test provider langsung dari browser with API key support
- **Multi-Provider Scanning**: Test endpoint dari mana-mana AI provider
- **Behavioral Profiling**: 4 diagnostic tests analyze response patterns
- **Model Signature Matching**: Compare against known model artifacts
- **Confidence Scoring**: Ranked hypotheses dengan statistical confidence
- **Python CLI Tool** — Batch testing with automated reports (--endpoint / --token / --config / --output)
- **Issue Detection** — Auto-flag masking, downgrade, false aliases
- **UMD Module Pattern**: Boleh pakai dalam Node.js atau browser tanpa dependencies
- **Zero External Dependencies**: Pure JavaScript + native fetch API

## 🚀 Live Demo & Download

### Direct Link to Live Dashboard

**🌐 Test Now:** [mohdsyahid.github.io/ai-detection-malaysia](https://mohdsyahid.github.io/ai-detection-malaysia/)

Features on live page:
- ✅ Quick provider presets (OpenAI/Anthropic/Azure/Cohere)
- ✅ Input your own endpoint + API token
- ✅ Expected model comparison alerts
- ✅ Tabbed UI (Web Checker / Python CLI / Instructions)
- ✅ Real-time animated results with score bars

### Python CLI Installation

```bash
# Clone or download from releases
git clone https://github.com/mohdsyahid/ai-detection-malaysia.git
cd ai-detection-malaysia

# Or download standalone script
curl -O https://raw.githubusercontent.com/mohdsyahid/ai-detection-malaysia/main/cli/ai-detector-cli.py
python -m pip install requests python-dotenv
```

## 📦 Repository Structure

```
ai-detection-malaysia/
├── cli/                    # Python CLI tools directory
│   ├── ai-detector-cli.py  # Main CLI executable
│   └── README.md           # CLI documentation
├── src/                    # Source files (development)
│   └── ai-detector.js     # Core UMD module with detection logic
├── docs/                   # Production-ready files for deployment
│   ├── ai-detector.js     # Built UMD module (same as src)
│   └── index.html         # Web dashboard UI
├── tests/                  # Unit tests using node:test
│   └── ai-detector.test.js
├── .github/workflows/      # CI/CD pipelines
│   └── ci.yml            # Automated testing on push
├── package.json
├── LICENSE                # MIT License
└── README.md              # This file
```

## 🔬 Cara Ia Berfungsi

### 4 Diagnostic Tests

| Test | Purpose | What It Detects |
|------|---------|-----------------|
| **Knowledge Cutoff** | Check date awareness | Claude/GPT mention training data limits; Qwen often silent on this |
| **Creativity Analysis** | Generate creative content | Response style to haiku/poetry requests, cultural awareness |
| **Code Generation** | Evaluate code understanding | Step-by-step explanations vs direct answers |
| **Verbosity Assessment** | Measure verbosity bias | Long elaborate (Claude) vs concise (Mistral) responses |

### Behavioral Signatures Detected

```javascript
claude: {
  keywords: ["as an AI", "however", "moreover"],
  structure: ["detailed explanation", "step-by-step"],
  hesitation: ["It's important to note"]
}

gpt4: {
  keywords: ["Here's a comprehensive", "In summary"],
  hallucination_markers: ["According to my knowledge"]
}

qwen: {
  keywords: ["Certainly", "Here is"],
  formatting: ["clean markdown", "direct answer"]
}

mistral: {
  keywords: ["Sure!", "Absolutely"],
  personality: ["casual tone", "brief answers"]
}
```

### Detection Capabilities

The tool can identify:

1. **Model Masking** — Vendor claims proprietary model but serves open-source under different name
2. **Model Downgrade** — Cheaper model served instead of advertised premium one
3. **False Aliases** — Fake model names that don't match capabilities
4. **Provider Routing** — Trace through cloud provider layers (Azure → OpenAI → proprietary)
5. **Response Pattern Analysis** — Confidence scoring based on behavioral fingerprints

## 🧪 Running Tests

```bash
# Run all test suites (Node.js tests)
npm test

# Individual test file
node --test tests/ai-detector.test.js

# Run Python CLI locally
python cli/ai-detector-cli.py \
  --endpoint https://api.openai.com/v1/chat/completions \
  --token sk-xxx \
  --expected-model gpt-4
```

All tests pass ✅ — includes behavioral pattern verification and edge case handling.

## 🔐 Privacy & Security Notes

- **No data logging**: All scanning happens client-side, no requests to our servers
- **Rate limiting respected**: Default timeout 15s per request to avoid spamming endpoints
- **Your API keys stay yours**: Auth tokens never leave your browser/local environment
- **Local execution only**: Python CLI runs completely offline except for target provider calls

## ⚠️ Disclaimer

This tool uses **probabilistic inference** based on response patterns. Results should be treated as **hypotheses**, not definitive proof.

- Confidence scores < 60% = low certainty
- Multiple hypotheses with similar scores = inconclusive
- Heavily customized models may not match signatures

For production compliance/auditing, request **model cards** or **technical documentation** directly from provider.

## 🌐 Browser Compatibility

Works in all modern browsers (Chrome, Firefox, Safari, Edge) thanks to UMD pattern. No build step required — just include `<script src="ai-detector.js"></script>` and use `window.AIDetector`.

Python CLI requires:
- Python 3.8+
- `requests` library
- `python-dotenv` (optional)

## 📄 License

MIT License — feel free to use, modify, distribute for personal/commercial projects.

## 👨‍💻 Author

Created by [@mohdsyahid](https://github.com/mohdsyahid) as part of Malaysian community open-data/utility project series.

---

**Built with ❤️ for the Malaysian tech community**

*Last Updated: 2026-09-05 | Version: 1.1.0*
