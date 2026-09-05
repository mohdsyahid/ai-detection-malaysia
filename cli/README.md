# AI Detection CLI Tool

Python command-line interface untuk batch testing dan automated scanning AI providers.

## Requirements

- Python 3.8+
- `requests` library
- `python-dotenv` (optional)

## Installation

```bash
pip install requests python-dotenv
```

Or let the script auto-install dependencies (it will prompt automatically).

## Quick Start

### Test Single Provider

```bash
python ai-detector-cli.py \
  --endpoint https://api.openai.com/v1/chat/completions \
  --token sk-xxx \
  --expected-model gpt-4
```

### Test Claude API

```bash
python ai-detector-cli.py \
  --endpoint https://api.anthropic.com/v1/messages \
  --token $ANTHROPIC_API_KEY \
  --expected-model claude-sonnet
```

### Use Environment Variables

Create `.env` file:

```env
OPENAI_API_KEY=sk-xxx
ANTHROPIC_API_KEY=sk-ant-api3-xxx
AZURE_API_KEY=your-azure-key
```

Then run without specifying token:

```bash
python ai-detector-cli.py \
  --endpoint https://api.openai.com/v1/chat/completions \
  --token $OPENAI_API_KEY
```

### Batch Testing with Config File

Create `provider.json`:

```json
{
  "name": "MyBank AI Service",
  "endpoint": "https://api.mybank.com/v1/generate",
  "headers": {
    "Authorization": "Bearer sk-xxxxx"
  },
  "body_template": {
    "prompt": "${PROMPT}",
    "max_tokens": 200
  },
  "expected_model": "claude-3-sonnet"
}
```

Run:

```bash
python ai-detector-cli.py --config provider.json --output report.json
```

## Command Line Options

| Option | Short | Description |
|--------|-------|-------------|
| `--endpoint` | `-e` | **Required.** API endpoint URL |
| `--token` | `-t` | Auth token or API key |
| `--expected-model` | | Expected model name for comparison |
| `--config` | `-c` | JSON config file path |
| `--output` | `-o` | Output JSON report file path |
| `--timeout` | | Request timeout in ms (default: 15000) |

## Available Expected Models

- `claude-sonnet` - Anthropic Claude Sonnet
- `claude-opus` - Anthropic Claude Opus  
- `gpt-4` - OpenAI GPT-4
- `gpt-3.5-turbo` - OpenAI GPT-3.5 Turbo
- `qwen-2.5` - Qwen 2.5
- `llama-3` - Llama 3
- `custom` - Custom model (auto-detect)

## Output Features

### Terminal Output

- Real-time progress indicators for each test
- Color-coded test results (green = passed, red = failed)
- Summary of top hypotheses with confidence scores
- Warning alerts for potential detection issues

### JSON Report (`--output`)

When you specify `--output report.json`, you get structured data including:

```json
{
  "summary": {
    "provider": "MyBank AI Service",
    "endpoint": "https://api.mybank.com/...",
    "timestamp": "2026-09-05T10:45:32",
    "request_count": 4
  },
  "top_hypothesis": {
    "name": "qwen",
    "confidence": 72,
    "evidence": [
      "Demonstrates regional cultural awareness",
      "Prefers direct, concise responses"
    ]
  },
  "issues": [
    {
      "type": "warning",
      "message": "Potential model mismatch: claimed \"claude-sonnet\" but detected patterns suggest \"qwen\""
    }
  ],
  "test_details": [...]
}
```

## What It Tests

The CLI runs 4 diagnostic tests:

1. **Knowledge Cutoff Detection** - Checks if model mentions training data limits
2. **Creativity Analysis** - Analyze response to poetic/creative requests
3. **Code Generation Capability** - Evaluate code understanding style
4. **Verbosity Assessment** - Measure response length bias

Each test compares behavioral patterns against known signatures from:
- Claude family
- GPT-4/GPT-3.5
- Qwen series
- Llama models
- Mistral
- Gemini

## Privacy & Security

- All requests go directly from your machine to provider endpoints
- No data is logged or transmitted to third-party servers
- API keys never stored anywhere except your environment/config
- Local execution only — offline capable

## Examples

### Compare Multiple Providers

```bash
#!/bin/bash
# compare-providers.sh

ENDPOINTS=(
  "https://api.openai.com/v1/chat/completions:sk-openai-key:gpt-4"
  "https://api.anthropic.com/v1/messages:$ANTHROPIC_KEY:claude-sonnet"
  "https://api.example.com/v1/generate:$CUSTOM_KEY:custom"
)

for item in "${ENDPOINTS[@]}"; do
  IFS=':' read -r endpoint token model <<< "$item"
  echo "\n=== Testing $model ==="
  python ai-detector-cli.py \
    --endpoint "$endpoint" \
    --token "$token" \
    --expected-model "$model" \
    --output "${model}.json"
done
```

### Automated Weekly Monitoring

Add to crontab (`crontab -e`):

```cron
# Run AI provider detection every Monday at 9 AM
0 9 * * 1 cd /path/to/ai-detection-malaysia/cli && \
python ai-detector-cli.py -e "https://api.mybank.ai/generate" \
  -t "$BANK_AI_TOKEN" \
  --expected-model claude-sonnet \
  --output reports/weekly-$(date +\%Y-\%m-\%d).json
```

## Troubleshooting

### Connection Issues

If getting timeout errors:
- Check network connectivity
- Verify API endpoint URL is correct
- Increase timeout: `--timeout 30000`
- Check firewall/proxy settings

### Authentication Errors

If getting 401/403 errors:
- Verify token format (should be `Bearer xxx` or raw key)
- Check token hasn't expired
- Ensure permissions allow chat/completion access

### Low Confidence Scores

If all hypothesis confidence < 40%:
- Model may be heavily customized/fine-tuned
- Could be unknown variant not in signature database
- Try with multiple prompts for better signal

## License

MIT License — same as main repository.

## Source

Full source: https://github.com/mohdsyahid/ai-detection-malaysia/tree/main/cli
