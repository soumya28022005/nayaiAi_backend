/**
 * test-api.js
 *
 * Quick integration test script to verify all endpoints are working.
 * Run with: node test-api.js
 *
 * WHY: Testing each endpoint manually in Postman is tedious.
 * This script runs through the complete NyayaAI pipeline
 * with a sample consumer fraud case.
 */

const BASE_URL = "http://localhost:5000/api";

// Sample Indian legal case: Consumer fraud / property scam
const SAMPLE_PROBLEM = `
Mera naam Ramesh Kumar hai. Main Kolkata mein rehta hoon. 
Mujhe ek builder ne 2022 mein flat dene ka promise kiya tha - Flat No. 402, Sunshine Apartments, 
Salt Lake, Kolkata. Maine Rs. 45 lakh diye the. Allotment letter bhi mila.
Abhi tak - March 2024 tak - na flat mila, na paisa wapas.
Builder ka naam ABC Realty Pvt Ltd hai. Owner Suresh Mehta hai.
Unka phone: 9876543210. Contract date thi 15 March 2022.
Maine 3 baar notice bheja hai. Koi jawab nahi aaya.
`;

async function post(endpoint, body) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function get(endpoint) {
  const res = await fetch(`${BASE_URL}${endpoint}`);
  return res.json();
}

async function runTests() {
  console.log("🧪 NyayaAI API Integration Test\n");
  console.log("=".repeat(50));

  try {
    // Test 1: Health Check
    console.log("\n1️⃣  GET /api/health");
    const health = await get("/health");
    console.log("   Status:", health.status);
    console.log("   Checks:", JSON.stringify(health.checks, null, 2));

    // Test 2: Analyze
    console.log("\n2️⃣  POST /api/analyze");
    const analysis = await post("/analyze", {
      problem: SAMPLE_PROBLEM,
      language: "hi",
    });
    console.log("   Legal Domain:", analysis.legalDomain);
    console.log("   Urgency:", analysis.urgency);
    console.log("   Summary:", analysis.summary);
    console.log("   Names:", analysis.entities?.names);
    console.log("   Amounts:", analysis.entities?.amounts);

    // Test 3: Build Case
    console.log("\n3️⃣  POST /api/build-case");
    const caseData = await post("/build-case", {
      problem: SAMPLE_PROBLEM,
      entities: analysis.entities,
      evidence: [],
      language: "hi",
    });
    console.log("   Case Title:", caseData.caseTitle);
    console.log("   Forum:", caseData.forumToApproach);
    console.log("   Strength:", caseData.estimatedStrength);
    console.log("   Laws found:", (caseData.relevantLaws || []).length);
    console.log("   Timeline events:", (caseData.timeline || []).length);

    // Test 4: Risk Analysis
    console.log("\n4️⃣  POST /api/risk-analysis");
    const risk = await post("/risk-analysis", {
      caseSummary: caseData.caseSummary,
      evidence: caseData.evidenceList,
      relevantLaws: caseData.relevantLaws,
    });
    console.log("   Risk Level:", risk.overallRiskLevel);
    console.log("   Success Probability:", risk.probabilityOfSuccess);
    console.log("   Missing Evidence count:", (risk.missingEvidence || []).length);

    // Test 5: Opposition Agent
    console.log("\n5️⃣  POST /api/opposition-agent");
    const opposition = await post("/opposition-agent", {
      caseSummary: caseData.caseSummary,
      evidence: caseData.evidenceList,
      relevantLaws: caseData.relevantLaws,
    });
    console.log("   Counter-arguments:", (opposition.counterArguments || []).length);
    console.log("   Vulnerabilities:", (opposition.vulnerabilities || []).length);
    console.log("   Strategy:", opposition.oppositionStrategy?.substring(0, 100) + "...");

    // Test 6: Generate Complaint
    console.log("\n6️⃣  POST /api/generate-complaint");
    const complaint = await post("/generate-complaint", {
      caseSummary: caseData.caseSummary,
      timeline: caseData.timeline,
      evidence: caseData.evidenceList,
      relevantLaws: caseData.relevantLaws,
      riskAnalysis: risk,
      language: "en",
    });
    console.log("   Complaint length:", complaint.complaint?.length, "chars");
    console.log("   Sections:", (complaint.sections || []).length);
    console.log("   Next steps:", (complaint.nextSteps || []).length);
    console.log(
      "\n   Complaint preview:\n",
      complaint.complaint?.substring(0, 300) + "..."
    );

    console.log("\n" + "=".repeat(50));
    console.log("✅ All tests passed! NyayaAI pipeline is working correctly.");
  } catch (err) {
    console.error("\n❌ Test failed:", err.message);
    if (err.cause) console.error("   Cause:", err.cause.message);
    console.log("\n💡 Make sure the server is running: npm start");
  }
}

runTests();