# 🔍 AI Authentication Checker (Model Verification Tool)

> Check sama ada provider AI jual model yang sebenar atau sekadar rebrand/open-source wrapper. Detect underlying model melalui **behavioral profiling** dan **signature analysis**.

## 🎯 Masalah Yang Selesaikan

Banyak bank, fintech, dan corporate providers di Malaysia jual akses API dengan nama premium (contoh: "Claude Sonnet", "GPT-4"), tapi belakang tu kadang-kadang model lain (Qwen, Llama, dll). Tool ni membantu verify model identity sebelum kamu bayar untuk akses.

## ✨ Ciri-ciri Utama

- **Multi-Provider Scanning**: Test endpoint dari mana-mana AI provider
- **Behavioral Profiling**: 4 diagnostic tests analyze response patterns
- **Model Signature Matching**: Compare against known model artifacts
- **Confidence Scoring**: Ranked hypotheses dengan statistical confidence
- **UMD Module Pattern**: Boleh pakai dalam Node.js atau browser tanpa dependencies
- **Zero External Dependencies**: Pure JavaScript + native fetch API

## 🚀 Quick Start

### Web Interface

1. Open `docs/index.html` in browser (atau deploy ke GitHub Pages)
2. Masukkan API endpoint details
3. Click **"Start Model Detection"**
4. View ranked model hypotheses

**Live Demo:** https://mohdsyahid.github.io/ai-detection-malaysia/

### Node.js Usage

```javascript
const { scanProvider } = require('./docs/ai-detector.js');

const providerConfig = {
  name: "MyBank AI API",
  endpoint: "https://api.mybank.com/v1/generate",
  method: "POST",
  headers: {
    "Authorization": "Bearer sk-xxxxx"
  },
  bodyTemplate: JSON.stringify({
    prompt: "${PROMPT}",
    max_tokens: 200
  })
};

const result = await scanProvider(providerConfig);
console.log("Top Hypothesis:", result.hypotheses[0]);
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

## 📦 Repository Structure

```
ai-detection-malaysia/
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

## 🧪 Running Tests

```bash
# Run all test suites
npm test

# Individual test file
node --test tests/ai-detector.test.js
```

All tests pass ✅ - includes behavioral pattern verification and edge case handling.

## 🔐 Privacy & Security Notes

- **No data logging**: All scanning happens client-side, no requests to our servers
- **Rate limiting respected**: Default timeout 15s per request to avoid spamming endpoints
- **Your API keys stay yours**: Auth tokens never leave your browser/local environment

## ⚠️ Disclaimer

This tool uses **probabilistic inference** based on response patterns. Results should be treated as **hypotheses**, not definitive proof.

- Confidence scores < 60% = low certainty
- Multiple hypotheses with similar scores = inconclusive
- Heavily customized models may not match signatures

For production compliance/auditing, request **model cards** or **technical documentation** directly from provider.

## 🌐 Browser Compatibility

Works in all modern browsers (Chrome, Firefox, Safari, Edge) thanks to UMD pattern. No build step required — just include `<script src="ai-detector.js"></script>` and use `window.AIDetector`.

## 📄 License

MIT License — feel free to use, modify, distribute for personal/commercial projects.

## 👨‍💻 Author

Created by [@mohdsyahid](https://github.com/mohdsyahid) as part of Malaysian community open-data/utility project series.

---

**Built with ❤️ for the Malaysian tech community**

*Last Updated: 2026-09-05 | Version: 1.0.0*
