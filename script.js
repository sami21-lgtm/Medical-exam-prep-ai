let groqApiKey = localStorage.getItem("GROQ_API_KEY") || "";
let questions = [];
let userAnswers = [];
let currentQuestionIndex = 0;
let totalTime = 60 * 60; // Default 60 mins
let timerInterval;
let isReviewMode = false;
let selectedSubjectMode = "FULL";

// LocalStorage Keys for History & Question Memory
const SEEN_QS_KEY = "MED_EXAM_SEEN_QUESTIONS_2026";
const HISTORY_KEY = "MED_EXAM_HISTORY_2026";

const delay = ms => new Promise(res => setTimeout(res, ms));

function getCurrentDateContext() {
    const today = new Date();
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return {
        dateStr: today.toLocaleDateString('bn-BD', options),
        year: today.getFullYear()
    };
}

function setApiKey() {
    let key = prompt("আপনার Groq Cloud (gsk_...) API Key দিন:", groqApiKey);
    if (key) {
        groqApiKey = key.trim();
        localStorage.setItem("GROQ_API_KEY", groqApiKey);
        alert("Groq API Key সফলভাবে সেভ হয়েছে!");
    }
}

function getSeenQuestionIDs() {
    try {
        return JSON.parse(localStorage.getItem(SEEN_QS_KEY)) || [];
    } catch (e) {
        return [];
    }
}

function saveSeenQuestions(newQs) {
    let seenList = getSeenQuestionIDs();
    newQs.forEach(q => {
        if (q.text) seenList.push(q.text.trim().substring(0, 40));
    });
    // Keep last 1000 questions memory to avoid repetition
    if (seenList.length > 1000) seenList = seenList.slice(-1000);
    localStorage.setItem(SEEN_QS_KEY, JSON.stringify(seenList));
}

function selectSubjectFilter(mode) {
    selectedSubjectMode = mode;
    
    // Update active UI badges
    const badges = document.querySelectorAll('.subject-badges .badge');
    badges.forEach(b => b.classList.remove('active'));
    
    if (mode === 'FULL') badges[0]?.classList.add('active');
    else if (mode === 'CHEM') badges[1]?.classList.add('active');
    else if (mode === 'PHY') badges[2]?.classList.add('active');
    else if (mode === 'ENG') badges[3]?.classList.add('active');
    else if (mode === 'GK') badges[4]?.classList.add('active');

    generateGroqQuestions();
}

async function generateGroqQuestions() {
    if (!groqApiKey) {
        setApiKey();
        if (!groqApiKey) {
            alert("Groq AI দিয়ে প্রশ্ন জেনারেট করতে API Key দিতে হবে!");
            return;
        }
    }

    const loader = document.getElementById('loading-overlay');
    if (loader) loader.style.display = 'flex';
    document.getElementById('result-modal').style.display = 'none';
    
    questions = [];
    isReviewMode = false;

    const dateCtx = getCurrentDateContext();
    let subBatches = [];

    // Official Medical Admission Distribution (Total 100 Marks)
    // Bio: 30, Chem: 25, Physics: 15, English: 15, GK & Values: 15
    if (selectedSubjectMode === "FULL") {
        totalTime = 60 * 60;
        subBatches = [
            { 
                subject: "জীববিজ্ঞান", count: 30, 
                prompt: "Generate EXACTLY 30 Medical MCQs in Bengali based strictly on 2026 Editions of Botany (Dr. Abul Hasan, Prof. Dr. Abdul Alim) and Zoology (Gazi Azmal, Prof. Majeda Begum). Include 4-5 genetics/cell division mental calculations." 
            },
            { 
                subject: "রসায়ন", count: 25, 
                prompt: "Generate EXACTLY 25 Medical MCQs in Bengali covering Chemistry 1st & 2nd Paper (Hazari & Nag, Dr. Sanjit Kumar Guha, Dr. Haradhan Dutta, Swapan Kumar Roy - 2026 Edition). MUST INCLUDE 8-10 calculator-free shortcut numericals (pH, oxidation state, gas laws, electrochemistry)." 
            },
            { 
                subject: "পদার্থবিজ্ঞান", count: 15, 
                prompt: "Generate EXACTLY 15 Medical MCQs in Bengali covering Physics 1st & 2nd Paper (Prof. Md. Ishaak, Shahjahan Tapan, Dr. Gias Uddin, Dr. Amir Hossain Khan - 2026 Edition). MUST INCLUDE 6-8 calculator-free shortcut numericals (Vector, kinetic energy, resistance, half-life, optics)." 
            },
            { 
                subject: "ইংরেজি", count: 15, 
                prompt: "Generate EXACTLY 15 Medical Admission English MCQs focusing on Synonyms, Antonyms, Appropriate Prepositions, Voice, Narration, and Sentence Correction." 
            },
            { 
                subject: "সাধারণ জ্ঞান ও মানবিক গুণাবলী", count: 15, 
                prompt: `Generate EXACTLY 15 Medical MCQs in Bengali covering Bangladesh Liberation War 1971, History of Bangladesh, Current Affairs up to ${dateCtx.dateStr} (${dateCtx.year}), and Medical Ethics/Human Values.` 
            }
        ];
    } else if (selectedSubjectMode === "CHEM") {
        totalTime = 15 * 60;
        subBatches = [{
            subject: "রসায়ন", count: 25,
            prompt: "Generate EXACTLY 25 Medical MCQs in Bengali (Hazari & Nag, Sanjit Guha, Haradhan Dutta 2026 Edition) with 10 calculator-free numericals solvable in 1-3 seconds."
        }];
    } else if (selectedSubjectMode === "PHY") {
        totalTime = 12 * 60;
        subBatches = [{
            subject: "পদার্থবিজ্ঞান", count: 15,
            prompt: "Generate EXACTLY 15 Medical MCQs in Bengali (Prof. Md. Ishaak, Shahjahan Tapan, Gias Uddin 2026 Edition) with 8 calculator-free shortcut numericals solvable in 1-3 seconds."
        }];
    } else if (selectedSubjectMode === "ENG") {
        totalTime = 9 * 60;
        subBatches = [{
            subject: "ইংরেজি", count: 15,
            prompt: "Generate EXACTLY 15 Medical Admission English MCQs focusing on Synonyms, Antonyms, Appropriate Prepositions, Voice, Narration, and Correction."
        }];
    } else if (selectedSubjectMode === "GK") {
        totalTime = 9 * 60;
        subBatches = [{
            subject: "সাধারণ জ্ঞান ও মানবিক গুণাবলী", count: 15,
            prompt: `Generate EXACTLY 15 Medical MCQs in Bengali covering Bangladesh History, 1971 War, Current Affairs for ${dateCtx.year} up to ${dateCtx.dateStr}, and Medical Ethics.`
        }];
    }

    userAnswers = new Array(
        subBatches.reduce((total, b) => total + b.count, 0)
    ).fill(null);

    try {
        const seenList = getSeenQuestionIDs();

        for (let i = 0; i < subBatches.length; i++) {
            const b = subBatches[i];
            document.getElementById('loading-text').innerText = `${b.subject} বিষয় তৈরি হচ্ছে (${questions.length} টি লোড হয়েছে)...`;
            
            if (i > 0) await delay(1200);

            let fetched = await fetchBatchGuaranteed(b.prompt, b.count, b.subject, dateCtx, seenList);
            questions = questions.concat(fetched);
        }

        saveSeenQuestions(questions);
        if (loader) loader.style.display = 'none';
        initQuiz();
    } catch (error) {
        console.error("Groq Generation Error:", error);
        alert("প্রশ্ন জেনারেট করতে সমস্যা হয়েছে। দয়া করে আবার চেষ্টা করুন।");
        if (loader) loader.style.display = 'none';
    }
}

async function fetchBatchGuaranteed(specificPrompt, expectedCount, subjectName, dateCtx, seenList) {
    let resultQuestions = [];
    let attempts = 0;
    const modelName = "llama-3.1-8b-instant";

    while (resultQuestions.length < expectedCount && attempts < 4) {
        attempts++;
        const needed = expectedCount - resultQuestions.length;
        const uniqueSeed = `${Date.now()}_${Math.floor(Math.random() * 1000000)}_${attempts}`;
        
        // Random 10 sample seen texts to prevent repeat
        const recentSeenSample = seenList.slice(-15).join(" | ");

        const promptText = `You are an official Bangladesh Medical Admission Test Question Setter.
        Live Date Context: ${dateCtx.dateStr}, Year: ${dateCtx.year}.
        UNIQUE RANDOM SEED: ${uniqueSeed}
        PREVIOUSLY ASKED QUESTIONS TO AVOID (DO NOT REPEAT): [${recentSeenSample}]
        
        TASK: ${specificPrompt}
        Provide EXACTLY ${needed} unique MCQs in Bengali.
        
        CRITICAL RULES:
        1. Writers & Textbooks: Base strictly on 2026 Bangladeshi edition textbooks (Biology: Hasan, Azmal, Majeda, Alim; Chemistry: Hazari-Nag, Guha, Dutta; Physics: Ishaak, Tapan, Gias Uddin).
        2. Math/Numerical Rule: For Physics, Chemistry, and Biology Genetics Math, ANY calculation MUST be solvable WITHOUT a calculator within 1 to 3 seconds using mental shortcuts/formulas.
        3. Shortcut Explanation Requirement: In the "explanation" field, MUST include "⚡ ১-৩ সেকেন্ডের শর্টকাট ট্রিক / সূত্র: [শর্টকাট সূত্র বা টেকনিক]"!
        4. Detailed Reference with Page Number: In the "reference" field, write exact author, chapter, and estimated page number from 2026 edition (e.g. "রেফারেন্স: ড. আবুল হাসান (উদ্ভিদবিজ্ঞান ২০২৬ সংস্করণ), অধ্যায় ৩, পৃষ্ঠা ৮৫").
        
        OUTPUT RAW JSON ONLY (NO MARKDOWN WRAPPERS):
        {
          "questions": [
            {
              "text": "প্রশ্ন টেক্সট",
              "options": ["অপশন ১", "অপশন ২", "অপশন ৩", "অপশন ৪"],
              "answer": 0,
              "subject": "${subjectName}",
              "explanation": "⚡ ১-৩ সেকেন্ডের শর্টকাট ট্রিক / সূত্র: ...। ২০২৬ প্রামাণ্য পাঠ্যবই অনুযায়ী বিস্তারিত ব্যাখ্যা।",
              "reference": "রেফারেন্স: লেখক ও অধ্যায়ের নাম, পৃষ্ঠা নং (২০২৬ সংস্করণ)"
            }
          ]
        }`;

        try {
            const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${groqApiKey}`
                },
                body: JSON.stringify({
                    model: modelName,
                    messages: [{ role: "user", content: promptText }],
                    temperature: 0.35,
                    max_tokens: 4000,
                    response_format: { type: "json_object" }
                })
            });

            if (response.status === 429) {
                await delay(2500);
                continue;
            }

            if (!response.ok) throw new Error(`Groq HTTP Status: ${response.status}`);

            const data = await response.json();
            let rawContent = data.choices[0].message.content;
            rawContent = rawContent.replace(/```json/gi, '').replace(/```/g, '').trim();
            
            const parsedData = JSON.parse(rawContent);
            const batchQs = parsedData.questions || parsedData.Questions || [];

            if (batchQs.length > 0) {
                resultQuestions = resultQuestions.concat(batchQs);
            }
        } catch (err) {
            console.warn(`Attempt ${attempts} failed. Retrying...`, err);
            await delay(1500);
        }
    }

    return resultQuestions.slice(0, expectedCount);
}

function initQuiz() {
    currentQuestionIndex = 0;
    userAnswers = new Array(questions.length).fill(null);
    renderOMRGrid();
    loadQuestion(0);
    
    if (timerInterval) clearInterval(timerInterval);
    startTimer();
}

function renderOMRGrid() {
    const gridContainer = document.getElementById('omr-grid');
    if (!gridContainer) return;
    gridContainer.innerHTML = '';
    
    for (let i = 0; i < questions.length; i++) {
        const btn = document.createElement('button');
        btn.classList.add('omr-btn');
        btn.innerText = i + 1;
        btn.id = `omr-${i}`;
        btn.onclick = () => loadQuestion(i);
        gridContainer.appendChild(btn);
    }
}

function loadQuestion(index) {
    if (!questions[index]) return;
    currentQuestionIndex = index;
    const q = questions[index];
    
    document.getElementById('question-number').innerText = `প্রশ্ন নং: ${index + 1}/${questions.length}`;
    document.getElementById('subject-tag').innerText = q.subject || "সাধারণ";
    document.getElementById('question-text').innerText = q.text;
    
    const optionsContainer = document.getElementById('options-container');
    optionsContainer.innerHTML = '';
    
    const prefixes = ['A', 'B', 'C', 'D'];
    q.options.forEach((opt, optIndex) => {
        const btn = document.createElement('button');
        btn.classList.add('option-btn');
        
        if (isReviewMode) {
            if (optIndex === q.answer) {
                btn.classList.add('correct-ans');
            } else if (userAnswers[index] === optIndex && userAnswers[index] !== q.answer) {
                btn.classList.add('wrong-ans');
            }
        } else {
            if (userAnswers[index] === optIndex) btn.classList.add('selected');
            btn.onclick = () => selectOption(optIndex);
        }
        
        btn.innerHTML = `<span class="option-prefix">${prefixes[optIndex]}</span> <span>${opt}</span>`;
        optionsContainer.appendChild(btn);
    });

    const explanationBox = document.getElementById('explanation-box');
    if (isReviewMode) {
        explanationBox.style.display = 'block';
        document.getElementById('explanation-ref').innerText = q.reference || "২০২৬ সংস্করণের প্রামাণ্য মূল বই";
        document.getElementById('explanation-text').innerHTML = q.explanation || "সঠিক উত্তর ও প্রামাণ্য তথ্য অনুযায়ী সাজানো হয়েছে।";
    } else {
        explanationBox.style.display = 'none';
    }

    updateOMRHighlight();
}

function selectOption(optionIndex) {
    if (isReviewMode) return;
    userAnswers[currentQuestionIndex] = optionIndex;
    
    const btns = document.querySelectorAll('.option-btn');
    btns.forEach((btn, idx) => {
        if (idx === optionIndex) btn.classList.add('selected');
        else btn.classList.remove('selected');
    });
    updateOMRHighlight();
}

function updateOMRHighlight() {
    for (let i = 0; i < questions.length; i++) {
        const omrBtn = document.getElementById(`omr-${i}`);
        if (omrBtn) {
            omrBtn.classList.remove('current', 'answered');
            if (userAnswers[i] !== null) omrBtn.classList.add('answered');
            if (i === currentQuestionIndex) omrBtn.classList.add('current');
        }
    }
}

function nextQuestion() {
    if (currentQuestionIndex < questions.length - 1) loadQuestion(currentQuestionIndex + 1);
}

function prevQuestion() {
    if (currentQuestionIndex > 0) loadQuestion(currentQuestionIndex - 1);
}

function startTimer() {
    timerInterval = setInterval(() => {
        if (totalTime <= 0) {
            clearInterval(timerInterval);
            submitExam();
        } else {
            totalTime--;
            let mins = Math.floor(totalTime / 60);
            let secs = totalTime % 60;
            document.getElementById('timer').innerText = 
                `${mins < 10 ? '০' : ''}${mins}:${secs < 10 ? '০' : ''}${secs}`;
        }
    }, 1000);
}

function submitExam() {
    clearInterval(timerInterval);
    let correct = 0, wrong = 0;
    
    userAnswers.forEach((ans, idx) => {
        if (ans !== null && questions[idx]) {
            if (ans === questions[idx].answer) correct++;
            else wrong++;
        }
    });

    const negative = wrong * 0.25;
    const candidateDeductionEl = document.getElementById('candidate-type');
    const candidateDeduction = candidateDeductionEl ? parseFloat(candidateDeductionEl.value) : 0;
    const finalScore = (correct - negative - candidateDeduction).toFixed(2);

    document.getElementById('correct-count').innerText = correct;
    document.getElementById('wrong-count').innerText = wrong;
    document.getElementById('negative-marks').innerText = negative.toFixed(2);
    if (document.getElementById('deduction-marks')) {
        document.getElementById('deduction-marks').innerText = candidateDeduction.toFixed(2);
    }
    document.getElementById('final-score').innerText = Math.max(0, finalScore);

    // Save Exam Record to History
    saveExamToHistory({
        date: new Date().toLocaleString('bn-BD'),
        score: finalScore,
        correct: correct,
        wrong: wrong,
        totalQuestions: questions.length,
        questionsData: questions,
        userAnswersData: userAnswers
    });

    document.getElementById('result-modal').style.display = 'flex';
}

function reviewExam() {
    isReviewMode = true;
    document.getElementById('result-modal').style.display = 'none';
    loadQuestion(0);
}

/* Exam History System Functions */
function saveExamToHistory(examRecord) {
    let history = [];
    try {
        history = JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
    } catch(e) { history = []; }
    
    history.unshift(examRecord); // Newest first
    if (history.length > 20) history = history.slice(0, 20); // Keep last 20 exams
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function openHistoryModal() {
    let history = [];
    try {
        history = JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
    } catch(e) { history = []; }

    const listContainer = document.getElementById('history-list');
    listContainer.innerHTML = '';

    if (history.length === 0) {
        listContainer.innerHTML = '<p style="text-align:center; padding:20px;">কোনো পূর্ববর্তী পরীক্ষার ইতিহাস পাওয়া যায়নি।</p>';
    } else {
        history.forEach((record, idx) => {
            const item = document.createElement('div');
            item.classList.add('history-item');
            item.innerHTML = `
                <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                    <strong>🗓️ তারিখ: ${record.date}</strong>
                    <span style="color:#0284c7; font-weight:bold;">স্কোর: ${record.score} / ${record.totalQuestions}</span>
                </div>
                <div style="font-size:13px; color:#64748b; margin-bottom:10px;">
                    সঠিক: ${record.correct} | ভুল: ${record.wrong} | বিষয়: ${record.totalQuestions} টি প্রশ্ন
                </div>
                <button class="btn-start" onclick="loadSavedExamHistory(${idx})">📖 উত্তরমালা ও ব্যাখ্যা দেখুন</button>
            `;
            listContainer.appendChild(item);
        });
    }

    document.getElementById('history-modal').style.display = 'flex';
}

function closeHistoryModal() {
    document.getElementById('history-modal').style.display = 'none';
}

function loadSavedExamHistory(index) {
    let history = [];
    try {
        history = JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
    } catch(e) { history = []; }

    if (history[index]) {
        questions = history[index].questionsData;
        userAnswers = history[index].userAnswersData;
        isReviewMode = true;
        closeHistoryModal();
        renderOMRGrid();
        loadQuestion(0);
    }
}

window.onload = () => {
    if (!groqApiKey) setApiKey();
    generateGroqQuestions();
};
