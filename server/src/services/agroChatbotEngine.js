/**
 * Kisan Mitra - Nirmala Enterprises Agro AI Chatbot Engine
 * Hybrid engine: Gemini API when GEMINI_API_KEY is available + Built-in Agro Knowledge Base fallback.
 */

const KNOWLEDGE_BASE = {
  maize: {
    keywords: ['maize', 'makka', 'corn', 'maka', 'ମକା', 'मक्का', 'faw', 'armyworm', 'fall armyworm'],
    en: `🌽 **Maize (Makka) Cultivation Advisory**
• **Best Sowing Time:** Kharif (June 15 – July 15) | Rabi (October 15 – November 20).
• **Seed Rate & Spacing:** 7-8 kg/acre for hybrids (Pioneer P3502, Syngenta NK6240, CP-818). Spacing: 60 cm (row) x 20 cm (plant).
• **Fertilizer Dose per Acre:**
  - *Basal (At Sowing):* 1 bag DAP (50kg) + 1 bag MOP Potash (50kg) + 10 kg Zinc Sulfate.
  - *Top Dressing 1 (Knee-high, 30 days):* 1 bag Urea (45kg).
  - *Top Dressing 2 (Tasseling, 50 days):* 1 bag Urea (45kg).
• **Fall Armyworm (FAW) Control:**
  - Spray **Emamectin Benzoate 5% SG** @ 0.4 g/litre OR **Coragen (Chlorantraniliprole 18.5% SC)** @ 0.4 ml/litre directly into the plant whorls.
• *Procurement Note:* Nirmala Enterprises purchases harvested maize at competitive market prices with instant weighing and direct passbook settlement in Umarkote!`,
    or: `🌽 **ମକା ଚାଷ ପାଇଁ ବିଶେଷଜ୍ଞ ପରାମର୍ଶ**
• **ବୁଣିବା ସମୟ:** ଖରିଫ (ଜୁନ ୧୫ – ଜୁଲାଇ ୧୫) | ରବି (ଅକ୍ଟୋବର ୧୫ – ନଭେମ୍ବର ୨୦).
• **ବିହନ ପରିମାଣ:** ଏକର ପ୍ରତି ୭-୮ କେଜି (Pioneer, Syngenta, CP ହାଇବ୍ରିଡ଼). ଧାଡ଼ିକୁ ଧାଡ଼ି ୬୦ ସେମି, ଗଛକୁ ଗଛ ୨୦ ସେମି.
• **ସାର ପ୍ରୟୋଗ (ଏକର ପିଛା):**
  - *ମୂଳସାର (ବୁଣିବା ସମୟରେ):* ୧ ବସ୍ତା DAP (୫୦ କେଜି) + ୧ ବସ୍ତା MOP ପଟାସ (୫୦ କେଜି) + ୧୦ କେଜି ଜିଙ୍କ ସଲଫେଟ୍.
  - *ପ୍ରଥମ କିସ୍ତି ୟୁରିଆ (୩୦ ଦିନରେ):* ୧ ବସ୍ତା ୟୁରିଆ (୪୫ କେଜି).
  - *ଦ୍ୱିତୀୟ କିସ୍ତି ୟୁରିଆ (ଫୁଲ ଆସିବା ପୂର୍ବରୁ - ୫୦ ଦିନରେ):* ୧ ବସ୍ତା ୟୁରିଆ (୪୫ କେଜି).
• **ସେନା ପୋକ (Fall Armyworm) ଦମନ:**
  - ଏମାମେକ୍ଟିନ ବେନଜୋଏଟ୍ ୫% SG (୦.୪ ଗ୍ରାମ/ଲିଟର ପାଣି) କିମ୍ବା କୋରାଜେନ୍ (୦.୪ ମିଲି/ଲିଟର) ଗଛର ଗୁବାରେ ସ୍ପ୍ରେ କରନ୍ତୁ.
• ନିର୍ମଳା ଏଣ୍ଟରପ୍ରାଇଜେସ୍ ଉମରକୋଟ ମଣ୍ଡିରେ ଉଚିତ ମୂଲ୍ୟରେ ମକା କ୍ରୟ କରେ.`,
    hi: `🌽 **मक्का की उन्नत खेती परामर्श**
• **बुवाई का उपयुक्त समय:** खरीफ (15 जून – 15 जुलाई) | रबी (15 अक्टूबर – 20 नवंबर).
• **बीज दर व दूरी:** 7-8 किग्रा प्रति एकड़ (Pioneer, Syngenta, CP हाइब्रिड). कतार से कतार 60 सेमी, पौधे से पौधा 20 सेमी.
• **उर्वरक प्रबंधन (प्रति एकड़):**
  - *बुवाई के समय:* 1 बोरी DAP (50 किग्रा) + 1 बोरी पोटाश (MOP 50 किग्रा) + 10 किग्रा जिंक सल्फेट.
  - *पहला यूरिया (30 दिन बाद):* 1 बोरी यूरिया (45 किग्रा).
  - *दूसरा यूरिया (मंजरी आते समय, 50 दिन):* 1 बोरी यूरिया (45 किग्रा).
• **फॉल आर्मीवॉर्म (सैनिक कीट) नियंत्रण:**
  - इमामेक्टिन बेंजोएट 5% SG (0.4 ग्राम/लीटर) या कोराजन (0.4 मिली/लीटर) पौधे के पोंगे (whorl) में छिड़कें.
• निर्मला एंटरप्राइजेज उमरकोट में मक्के की सीधी नकद खरीद एवं पासबुक भुगतान सुविधा उपलब्ध कराती है!`
  },

  paddy: {
    keywords: ['paddy', 'rice', 'dhan', 'dhana', 'ଧାନ', 'धान', 'blast', 'bph'],
    en: `🌾 **Paddy / Rice Crop Management**
• **Varieties:** Swarna (MTU 7029), Pooja, MTU 1010, CR Dhan 310.
• **Fertilizer Dose per Acre:**
  - *Basal:* 1 bag DAP + 1 bag MOP Potash + 25 kg Zinc Sulfate.
  - *Tillering stage (20-25 days):* 25-30 kg Urea.
  - *Panicle stage (45-50 days):* 20 kg Urea.
• **Stem Borer & BPH (Brown Plant Hopper) Control:**
  - Apply Cartap Hydrochloride 4G @ 7-8 kg/acre or spray Pexalon @ 94 ml/acre with sufficient water at the base of hills.
• **Blast Disease Control:** Tricyclazole 75% WP @ 0.6 g/litre water.`,
    or: `🌾 **ଧାନ ଚାଷ ଓ ରୋଗ ପୋକ ନିୟନ୍ତ୍ରଣ**
• **ଉନ୍ନତ କିସମ:** ସ୍ୱର୍ଣ୍ଣ (MTU 7029), ପୂଜା, MTU 1010, CR ଧାନ ୩୧୦.
• **ସାର ପ୍ରୟୋଗ (ଏକର ପିଛା):**
  - *ରୁଆ ବେଳେ:* ୧ ବସ୍ତା DAP + ୧ ବସ୍ତା MOP ପଟାସ + ୧୦ କେଜି ଜିଙ୍କ୍.
  - *ପିଲ ଛାଡିବା ସମୟ (୨୦-୨୫ ଦିନ):* ୨୫ କେଜି ୟୁରିଆ.
  - *ଥୋଡ଼ ବାହାରିବା ସମୟରେ (୪୫ ଦିନ):* ୨୦ କେଜି ୟୁରିଆ.
• **ଝାଉଁଳା ଓ ମାଟିଆ ଗୁଣ୍ଡି ପୋକ (BPH) ଦମନ:**
  - କାର୍ଟାପ ହାଇଡ୍ରୋକ୍ଲୋରାଇଡ୍ ୪G କିମ୍ବା ପେକ୍ସାଲୋନ୍ (Pexalon) ୯୪ ମିଲି ଏକର ପ୍ରତି ସ୍ପ୍ରେ କରନ୍ତୁ.`,
    hi: `🌾 **धान की उन्नत खेती व सुरक्षा**
• **प्रमुख किस्में:** स्वर्णा (MTU 7029), पूजा, MTU 1010, सीआर धान.
• **उर्वरक प्रबंधन (प्रति एकड़):**
  - *रोपाई के समय:* 1 बोरी DAP + 1 बोरी पोटाश (MOP) + 10 किग्रा जिंक सल्फेट.
  - *कल्ले फूटते समय (20-25 दिन):* 25-30 किग्रा यूरिया.
  - *बाली निकलने से पूर्व (45 दिन):* 20 किग्रा यूरिया.
• **तना छेदक व भूरा फुदका (BPH) नियंत्रण:**
  - कार्टाप हाइड्रोक्लोराइड 4G दानेदार या पेक्सलोन 94 मिली प्रति एकड़ छिड़काव करें.`
  },

  fertilizer: {
    keywords: ['fertilizer', 'urea', 'dap', 'potash', 'mop', 'npk', 'zinc', 'sar', 'sara', 'ସାର', 'खाद', 'उर्वरक'],
    en: `🌱 **Fertilizer Guide & Best Practices**
• **Urea (46% N):** Never broadcast in standing water. Always apply in moist soil and split into 2-3 stages to prevent nitrogen loss.
• **DAP (18:46:0):** Apply strictly at the root zone during sowing or transplanting. Deep placement gives 30% higher root development.
• **MOP / Potash (0:0:60):** Essential for grain weight, luster, drought tolerance, and pest resistance. Do not skip potash!
• **Zinc Deficiency (Khaira):** Young leaves turn rusty bronze. Spray Zinc Sulfate 0.5% (5g/L) + Lime (2.5g/L) water.
• Available at Nirmala Enterprises warehouse: IFFCO, Paradeep Phosphates, KRIBHCO fertilizers at government mandated MRP.`,
    or: `🌱 **ସାର ପ୍ରୟୋଗ ନିୟମାବଳୀ**
• **ୟୁରିଆ:** କ୍ଷେତରେ ଅଧିକ ପାଣି ଥିବାବେଳେ ୟୁରିଆ ପକାନ୍ତୁ ନାହିଁ. ଓଦା ମାଟିରେ ୨ ରୁ ୩ କିସ୍ତିରେ ପ୍ରୟୋଗ କରନ୍ତୁ.
• **DAP:** ବୁଣିବା ବେଳେ ମାଟି ତଳେ ଚେର ପାଖରେ ଦେବା ସବୁଠାରୁ ଫଳପ୍ରଦ.
• **ପଟାସ (MOP):** ଦାନା ପୁଷ୍ଟ ଓ ଚମକଦାର କରିବା ପାଇଁ ପଟାସ ନିହାତି ଜରୁରୀ.
• ନିର୍ମଳା ଏଣ୍ଟରପ୍ରାଇଜେସ୍ ଷ୍ଟୋରରେ IFFCO, PPL ସାର ଉପଲବ୍ଧ.`,
    hi: `🌱 **उर्वरक प्रबंधन और संतुलित उपयोग**
• **यूरिया (46% नाइट्रोजन):** खेत में भरा पानी निकालकर नम मिट्टी में 2-3 बार में दें, ताकि बर्बादी न हो.
• **DAP (18:46:0):** बुवाई के समय बीज से 2 इंच नीचे जड़ों के पास डालें.
• **पोटाश (MOP):** दानों का वजन, चमक और रोग प्रतिरोधक क्षमता बढ़ाने के लिए पोटाश अनिवार्य है.
• निर्मला एंटरप्राइजेज पर सभी सरकारी प्रमाणित खाद उचित दर पर उपलब्ध हैं.`
  },

  mandiRates: {
    keywords: ['rate', 'price', 'mandi', 'msp', 'bhav', 'market', 'dara', 'ଦର', 'ମୂଲ୍ୟ', 'भाव', 'रेट', 'କେତେ'],
    en: `💰 **Government MSP & Market Procurement Rates (Odisha 2026)**
• **Maize (Makka / ମକା):** MSP ₹2,225 / Quintal | Nirmala Enterprises Spot Procuring: ₹2,150 – ₹2,320 / Qtl (depends on moisture <14%).
• **Paddy (Dhan / ଧାନ Common):** MSP ₹2,300 / Quintal.
• **Paddy (Grade A):** MSP ₹2,320 / Quintal.
• **Ragi (ମାଣ୍ଡିଆ):** MSP ₹4,290 / Quintal.
• **Soybean:** MSP ₹4,892 / Quintal.
👉 *Nirmala Enterprises provides immediate digital weighing, instant receipts, and direct bank/passbook credit!*`,
    or: `💰 **ସରକାରୀ ସହାୟକ ମୂଲ୍ୟ (MSP) ଓ ମଣ୍ଡି ଦର**
• **ମକା (Maize):** ସରକାରୀ MSP ₹୨,୨୨୫ / କ୍ୱିଣ୍ଟାଲ | ନିର୍ମଳା ଏଣ୍ଟରପ୍ରାଇଜେସ୍ ତୁରନ୍ତ କ୍ରୟ ଦର: ₹୨,୧୫୦ - ₹୨,୩୨୦ / କ୍ୱିଣ୍ଟାଲ (ଆର୍ଦ୍ରତା ୧୪% ରୁ କମ୍).
• **ଧାନ (ସାଧାରଣ):** MSP ₹୨,୩୦୦ / କ୍ୱିଣ୍ଟାଲ.
• **ଧାନ (ଗ୍ରେଡ୍-A):** MSP ₹୨,୩୨୦ / କ୍ୱିଣ୍ଟାଲ.
• **ମାଣ୍ଡିଆ (Ragi):** MSP ₹୪,୨୯୦ / କ୍ୱିଣ୍ଟାଲ.
👉 ଆମ କେନ୍ଦ୍ରରେ ଡିଜିଟାଲ୍ ଓଜନ ସହ ତୁରନ୍ତ ଟଙ୍କା ପାସ୍ ବୁକ୍ ରେ ଜମା ହୁଏ!`,
    hi: `💰 **सरकारी समर्थन मूल्य (MSP) और मंडी भाव 2026**
• **मक्का (Maize):** न्यूनतम समर्थन मूल्य ₹2,225 / क्विंटल | निर्मला एंटरप्राइजेज नकद खरीद: ₹2,150 – ₹2,320 / क्विंटल (नमी 14% से कम).
• **धान (सामान्य):** MSP ₹2,300 / क्विंटल.
• **धान (ग्रेड-ए):** MSP ₹2,320 / क्विंटल.
• **रागी (मडुआ):** MSP ₹4,290 / क्विंटल.
👉 हमारे केंद्र पर सटीक इलेक्ट्रॉनिक कांटा और तत्काल भुगतान की सुविधा है!`
  },

  aboutStore: {
    keywords: ['store', 'nirmala', 'contact', 'location', 'phone', 'address', 'owner', 'who', 'କେଉଁଠି', 'ଫୋନ', 'କମ୍ପାନୀ', 'दुकान', 'फोन', 'पता'],
    en: `🏢 **Nirmala Enterprises - Agro Trading & Farmer Support Hub**
• **Location:** Main Road, Umarkote, Dist: Nabarangpur, Odisha - 764073.
• **Helpline:** +91 9777986964 / +91 7848956963
• **Store Hours:** Monday – Saturday: 8:00 AM – 8:00 PM | Sunday: 9:00 AM – 2:00 PM
• **Services Offered:**
  1. Guaranteed Cash Purchase of Maize, Paddy, and Pulses.
  2. Certified Hybrid Seeds (Pioneer, Syngenta, CP, Kaveri).
  3. Certified IFFCO / PPL Fertilizers & Organic Bio-nutrients.
  4. Leading Brand Crop Protection (Bayer, Syngenta, UPL, Dhanuka).
  5. Zero-Interest Crop Inputs & Farmer Credit Passbook Facilities.`,
    or: `🏢 **ନିର୍ମଳା ଏଣ୍ଟରପ୍ରାଇଜେସ୍ ସମ୍ପର୍କରେ ସୂଚନା**
• **ଠିକଣା:** ମୁଖ୍ୟ ରାସ୍ତା, ଉମରକୋଟ, ଜିଲ୍ଲା: ନବରଙ୍ଗପୁର, ଓଡ଼ିଶା - ୭୬୪୦୭୩.
• **ହେଲ୍ପଲାଇନ୍ ଫୋନ:** +୯୧ ୯୭୭୭୯୮୬୯୬୪ / +୯୧ ୭୮୪୮୯୫୬୯୬୩
• **ଦୋକାନ ସମୟ:** ସୋମବାର - ଶନିବାର: ସକାଳ ୮:୦୦ ରୁ ରାତି ୮:୦୦.
• **ସେବା:** ମକା ଓ ଧାନ କ୍ରୟ, ଉନ୍ନତ ହାଇବ୍ରିଡ୍ ବିହନ, ସାର, କୀଟନାଶକ ଏବଂ ଚାଷୀ ଭାଇମାନଙ୍କ ପାଇଁ କ୍ରେଡିଟ୍ ପାସବୁକ୍ ସୁବିଧା.`,
    hi: `🏢 **निर्मला एंटरप्राइजेज - किसान सेवा केंद्र**
• **स्थान:** मेन रोड, उमरकोट, जिला: नबरंगपुर, ओडिशा - 764073.
• **हेल्पलाइन नंबर:** +91 9777986964 / +91 7848956963
• **समय:** सोमवार से शनिवार: सुबह 8:00 से रात 8:00 बजे तक.
• **मुख्य सेवाएं:** मक्का व धान की सीधी खरीद, उत्तम हाइब्रिड बीज, प्रमाणित खाद-कीटनाशक और किसान खाता पासबुक सुविधा.`
  }
};

/**
 * Generate answer using Gemini API if key is present, otherwise fallback to knowledge base.
 */
export async function getChatbotResponse({ message = '', language = 'en', history = [], env = {} }) {
  const query = (message || '').trim().toLowerCase();
  const apiKey = env.GEMINI_API_KEY || (typeof process !== 'undefined' && process.env && process.env.GEMINI_API_KEY);

  // Try Gemini API if key is available
  if (apiKey) {
    try {
      const geminiReply = await queryGeminiApi(apiKey, message, language, history);
      if (geminiReply) {
        return {
          success: true,
          reply: geminiReply,
          source: 'gemini-ai',
          language
        };
      }
    } catch (err) {
      console.warn('Gemini API call failed, falling back to local Agro KB:', err.message);
    }
  }

  // Fallback to rich Agricultural Knowledge Base
  return queryLocalKnowledgeBase(query, language);
}

function queryLocalKnowledgeBase(query, preferredLang = 'en') {
  // Detect language if user wrote in Odia or Hindi
  let lang = preferredLang;
  if (/[\u0B00-\u0B7F]/.test(query)) lang = 'or'; // Odia unicode block
  else if (/[\u0900-\u097F]/.test(query)) lang = 'hi'; // Devanagari unicode block

  // Check matching categories
  for (const key of Object.keys(KNOWLEDGE_BASE)) {
    const item = KNOWLEDGE_BASE[key];
    if (item.keywords.some(kw => query.includes(kw.toLowerCase()))) {
      return {
        success: true,
        reply: item[lang] || item.en,
        source: 'knowledge-base',
        category: key,
        language: lang
      };
    }
  }

  // Default helpful response
  const defaultReplies = {
    en: `🌾 **Namaskar! I am Kisan Mitra, your Agro AI Assistant at Nirmala Enterprises.**

I can assist you with:
1. 🌽 **Maize & Paddy Advisory:** Sowing dates, hybrid seed varieties, spacing & pest control (Fall Armyworm, Stem Borer).
2. 🌱 **Fertilizer Schedules:** Dosage for Urea, DAP, MOP Potash, Zinc and Micronutrients.
3. 💰 **Live Mandi & MSP Rates:** Official Odisha procurement prices for Maize, Paddy & Millets.
4. 🚜 **Products & Store Inquiries:** Stock, pricing and credit passbook queries in Umarkote.

*Type your question below or click one of the quick suggestions!*`,
    or: `🌾 **ନମସ୍କାର! ମୁଁ ଆପଣଙ୍କ 'କିଷାନ ମିତ୍ର' କୃଷି ସହାୟକ, ନିର୍ମଳା ଏଣ୍ଟରପ୍ରାଇଜେସ୍ ତରଫରୁ.**

ମୁଁ ଆପଣଙ୍କୁ ନିମ୍ନଲିଖିତ ବିଷୟରେ ସାହାଯ୍ୟ କରିପାରିବି:
୧. 🌽 **ମକା ଓ ଧାନ ଚାଷ:** ବୁଣିବା ସମୟ, ହାଇବ୍ରିଡ୍ ବିହନ ଓ ପୋକ ନିୟନ୍ତ୍ରଣ (ସେନା ପୋକ, କାଣ୍ଡ ବିନ୍ଧା).
୨. 🌱 **ସାର ପ୍ରୟୋଗ:** ୟୁରିଆ, DAP, ପଟାସ ଓ ଜିଙ୍କର ସଠିକ୍ ପରିମାଣ.
୩. 💰 **ଆଜିର ମଣ୍ଡି ଓ ସରକାରୀ MSP ଦର:** ମକା ଓ ଧାନର କ୍ରୟ ମୂଲ୍ୟ.
୪. 🏢 **ଦୋକାନ ଓ ପାସ୍ ବୁକ୍ ସୂଚନା:** ଉମରକୋଟ କେନ୍ଦ୍ରର ଯୋଗାଯୋଗ ଓ ସେବା.

*ଦୟାକରି ଆପଣଙ୍କ ପ୍ରଶ୍ନ ତଳେ ଟାଇପ୍ କରନ୍ତୁ!*`,
    hi: `🌾 **नमस्ते! मैं निर्मला एंटरप्राइजेज का 'किसान मित्र' एग्रो एआई सहायक हूँ.**

मैं आपकी इन विषयों में सहायता कर सकता हूँ:
1. 🌽 **मक्का व धान खेती परामर्श:** बुवाई, हाइब्रिड बीज व सैनिक कीट (FAW) नियंत्रण.
2. 🌱 **संतुलित खाद प्रबंधन:** यूरिया, डीएपी, पोटाश व सूक्ष्म पोषक तत्वों की उचित मात्रा.
3. 💰 **ताज़ा मंडी व सरकारी MSP भाव:** मक्का और धान के वर्तमान खरीद मूल्य.
4. 🏢 **स्टोर व पासबुक जानकारी:** उमरकोट केंद्र से संपर्क व सेवाएं.

*कृपया अपना प्रश्न नीचे लिखें या दिए गए विकल्पों पर क्लिक करें!*`
  };

  return {
    success: true,
    reply: defaultReplies[lang] || defaultReplies.en,
    source: 'knowledge-base',
    category: 'general',
    language: lang
  };
}

async function queryGeminiApi(apiKey, userPrompt, language, history = []) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const systemInstruction = `You are "Kisan Mitra", the dedicated Agricultural AI Consultant and Support Assistant for "Nirmala Enterprises", a leading agro trading and farmer support hub located in Umarkote, Nabarangpur district, Odisha, India (PIN 764073).
Your guidelines:
1. Provide accurate, practical, and highly empathetic farming advice for smallholder and commercial farmers (primarily growing Maize, Paddy, Ragi, Groundnut, Vegetables).
2. Answer clearly regarding seed varieties, fertilizer dosages (NPK, DAP, Urea, Potash, Zinc), crop disease/pest management (especially Fall Armyworm on maize and Brown Plant Hopper on paddy).
3. If the user asks about Nirmala Enterprises, mention store location (Main Road, Umarkote), phone (+91 9777986964 / 7848956963), and services (fair weighing grain procurement, seed/fertilizer sales, farmer ledger passbooks).
4. Language instruction: If language is "or" or query is in Odia script, respond in fluent Odia (ଓଡ଼ିଆ). If "hi" or query is in Hindi, respond in clean Hindi. Otherwise respond in simple, clear English.
5. Keep responses concise, structured with bullet points, and actionable for farmers.`;

  const contents = [];
  if (Array.isArray(history)) {
    for (const h of history.slice(-6)) {
      if (h.role && h.text) {
        contents.push({
          role: h.role === 'model' ? 'model' : 'user',
          parts: [{ text: h.text }]
        });
      }
    }
  }
  contents.push({
    role: 'user',
    parts: [{ text: userPrompt }]
  });

  const body = {
    system_instruction: {
      parts: [{ text: systemInstruction }]
    },
    contents,
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 800
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  return text || null;
}
