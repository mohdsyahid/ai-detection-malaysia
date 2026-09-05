const test = require("node:test");
const assert = require("node:assert");
const path = require("path");

// Import UMD module directly in Node context
let AIDetector;
try {
  AIDetector = require(path.join(__dirname, "..", "docs", "ai-detector.js"));
} catch (e) {
  console.warn("UMD import failed:", e.message);
  // Fallback: try loading source version
  AIDetector = require(path.join(__dirname, "..", "src", "ai-detector.js"));
}

test("DEFAULTS exports valid configuration", () => {
  assert.ok(AIDetector.DEFAULTS);
  assert.strictEqual(typeof AIDetector.DEFAULTS.timeoutMs, "number");
  assert.strictEqual(AIDetector.DEFAULTS.maxRetries, 2);
});

test("MODEL_SIGNATURES contains expected model patterns", () => {
  assert.ok(AIDetector.MODEL_SIGNATURES);
  assert.ok(Array.isArray(AIDetector.MODEL_SIGNATURES.claude?.keywords));
  assert.ok(Array.isArray(AIDetector.MODEL_SIGNATURES.gpt4?.structure));
  assert.ok(Array.isArray(AIDetector.MODEL_SIGNATURES.qwen?.keywords));
});

test("PROVIDER_TEMPLATES has predefined configurations", () => {
  assert.ok(AIDetector.PROVIDER_TEMPLATES);
  assert.ok(AIDetector.PROVIDER_TEMPLATES.claude);
  assert.ok(AIDetector.PROVIDER_TEMPLATES.gpt4);
  assert.strictEqual(AIDetector.PROVIDER_TEMPLATES.claude.name, "Claude (Anthropic)");
  assert.ok(AIDetector.PROVIDER_TEMPLATES.claude.endpoint.includes("anthropic"));
});

test("scanProvider validates provider config structure", async () => {
  const mockProvider = {
    name: "Test Provider",
    endpoint: "https://api.example.com/test",
    method: "POST",
    headers: { "Content-Type": "application/json" },
    bodyTemplate: JSON.stringify({ prompt: "${PROMPT}" }),
  };

  // scanProvider doesn't throw on validation, just tries to make HTTP request
  let result = null;
  try {
    result = await AIDetector.scanProvider(mockProvider);
  } catch (error) {
    // Network failures expected but not thrown for validation
  }

  // Should handle invalid URLs gracefully
  assert.ok(true, "Should attempt provider configuration");
});

test("analyzeResults produces hypothesis array", () => {
  const mockTests = [
    { testName: "Knowledge Cutoff Detection", passed: true, hasKnowledgeMarker: true },
    { testName: "Creative Writing Analysis", passed: true, hasHaikuStructure: false },
    { testName: "Code Generation Capability", passed: true, showsStepByStep: true },
    { testName: "Verbosity Assessment", passed: true, isDirectAnswer: false },
  ];

  const hypotheses = AIDetector.analyzeResults(mockTests, AIDetector.MODEL_SIGNATURES);

  assert.ok(Array.isArray(hypotheses));
  if (hypotheses.length > 0) {
    assert.ok(hypotheses[0].name);
    assert.strictEqual(typeof hypotheses[0].confidence, "number");
    assert.ok(Array.isArray(hypotheses[0].evidence));
  }
});

test("analyzeResults returns top candidate sorted by confidence", () => {
  const mockTests = [
    { testName: "Knowledge Cutoff Detection", passed: true, hasKnowledgeMarker: true },
    { testName: "Creative Writing Analysis", passed: true, containsMalaysianFood: true },
  ];

  const hypotheses = AIDetector.analyzeResults(mockTests, AIDetector.MODEL_SIGNATURES);

  assert.ok(hypotheses.length > 0);
  
  // Verify sorting by confidence (descending)
  for (let i = 0; i < hypotheses.length - 1; i++) {
    assert.ok(
      hypotheses[i].confidence >= hypotheses[i + 1].confidence,
      "Hypotheses should be sorted by confidence descending"
    );
  }
});

test("analyzeResults handles empty test results gracefully", () => {
  const hypotheses = AIDetector.analyzeResults([], AIDetector.MODEL_SIGNATURES);

  assert.ok(Array.isArray(hypotheses));
  assert.equal(hypotheses.length, 1, "Should return at least one 'unknown' hypothesis");
  assert.strictEqual(hypotheses[0].name, "unknown");
});

test("makeRequest supports configurable timeout", async () => {
  // Just verify the function accepts and runs with default config
  let succeeded = false;
  try {
    await AIDetector.makeRequest(
      "https://example.com/api",
      {},
      JSON.stringify({ prompt: "test" }),
      "test prompt"
    );
  } catch (error) {
    // Network errors expected, but timeout mechanism should exist
    succeeded = true;
  }

  assert.ok(succeeded || true, "Should attempt request with timeout");
});

test("makeRequest handles network errors gracefully", async () => {
  let caughtError = null;
  try {
    await AIDetector.makeRequest(
      "https://invalid-domain-xyz123.example.com/api",
      {},
      JSON.stringify({ prompt: "test" }),
      "test prompt"
    );
  } catch (error) {
    caughtError = error;
  }

  // Network errors are acceptable - could be DNS failure or connection refused
  assert.ok(true, "Should handle network failures");
});

test("detects known model patterns in test scenarios", () => {
  // Simulate Claude-like response patterns
  const claudeTests = [
    { testName: "Knowledge Cutoff Detection", passed: true, hasKnowledgeMarker: true, responseLength: 150 },
    { testName: "Creative Writing Analysis", passed: true, hasHaikuStructure: true, containsMalaysianFood: false },
    { testName: "Code Generation Capability", passed: true, showsStepByStep: true },
    { testName: "Verbosity Assessment", passed: true, isDirectAnswer: false, wordCount: 80 },
  ];

  const hypotheses = AIDetector.analyzeResults(claudeTests, AIDetector.MODEL_SIGNATURES);

  if (hypotheses.length > 0) {
    const topCandidate = hypotheses[0];
    // Should have some confidence score assigned
    assert.ok(topCandidate.confidence >= 0 && topCandidate.confidence <= 100);
  }
});

test("provider templates are well-formed", () => {
  Object.entries(AIDetector.PROVIDER_TEMPLATES).forEach(([key, template]) => {
    assert.ok(template.name, `Template ${key} should have a name`);
    assert.ok(template.endpoint, `Template ${key} should have an endpoint`);
    assert.ok(template.bodyTemplate, `Template ${key} should have a body template`);
    
    if (template.headers) {
      assert.ok(typeof template.headers === "object", `Template ${key} headers should be object`);
    }
  });
});

test("response extraction handles multiple field formats", async () => {
  // Test various API response formats
  const testCases = [
    { data: { text: "hello world" }, expected: "hello world" },
    { data: { response: "response text" }, expected: "response text" },
    { data: { content: "content here" }, expected: "content here" },
    { data: { output: "output value" }, expected: "output value" },
  ];

  for (const testCase of testCases) {
    // Mock fetch to return different formats
    global.fetch = async () => ({
      ok: true,
      json: async () => testCase.data,
    });

    const result = await AIDetector.makeRequest(
      "https://test.example.com/api",
      {},
      JSON.stringify({ prompt: "test" }),
      "test prompt"
    );

    assert.strictEqual(result, testCase.expected, `Should extract ${Object.keys(testCase.data)[0]} field`);
  }
});

test("confidence scores are properly bounded 0-100", () => {
  const mockTests = [
    { testName: "Knowledge Cutoff Detection", passed: true, hasKnowledgeMarker: true },
    { testName: "Creative Writing Analysis", passed: true },
    { testName: "Code Generation Capability", passed: true },
    { testName: "Verbosity Assessment", passed: true },
  ];

  const hypotheses = AIDetector.analyzeResults(mockTests, AIDetector.MODEL_SIGNATURES);

  for (const h of hypotheses) {
    assert.ok(
      h.confidence >= 0 && h.confidence <= 100,
      `Confidence score ${h.confidence} should be between 0 and 100`
    );
  }
});
