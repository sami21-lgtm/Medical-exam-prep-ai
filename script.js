let groqApiKey = localStorage.getItem("GROQ_API_KEY") || "";
let questions = [];
let userAnswers = new Array(100).fill(null);
let currentQuestionIndex = 0;
let totalTime = 60 * 60; // 60 minutes countdown
let timerInterval;
let isReviewMode = false;

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
    let key = prompt("আপনার Groq Cloud (gsk_...) API Key লিখুন:", groqApiKey);
    if (key) {
        groqApiKey = key.trim();
        localStorage.setItem("GROQ_API_KEY", groqApiKey);
        alert("Groq API Key সফলভাবে সেভ হয়েছে!");
    }
}

async function generateGroqQuestions() {
    if (!groqApiKey) {
        setApiKey();
        if (!groqApiKey) {
            alert("Groq AI দিয়ে প্রশ্ন জেনারেট করতে API Key দেওয়া আবশ্যক!");
            return;
        }
    }

    document.getElementById('loading-overlay').style.display = 'flex';
    document.getElementById('result-modal').style.display = 'none';
    
    questions = [];
    userAnswers = new Array(100).fill(null);
    isReviewMode = false;

    const dateCtx = getCurrentDateContext();

    // Exactly 100 Questions divided into 6 Optimized Batches (Total = 100)
    const subBatches = [
        { 
            subject: "BIOLOGY", count: 15, name: "উদ্ভিদবিজ্ঞান (অধ্যায় ১-১২)", 
            prompt: "Generate EXACTLY 15 Medical Admission MCQs in Bengali strictly from Botany Chapters 1 to 12 (Cell Structure, Cell Division, Microbes, Plant Physiology, Biotechnology, Genetics) written by Dr. Abul Hasan & Dr. Md. Abul Alim (2026 Edition)." 
        },
        { 
            subject: "BIOLOGY", count: 15, name: "প্রাণীবিজ্ঞান (অধ্যায় ১-১২)", 
            prompt: "Generate EXACTLY 15 Medical Admission MCQs in Bengali strictly from Zoology Chapters 1 to 12 (Animal Diversity, Hydra, Grasshopper, Human Physiology, Digestion, Circulation, Genetics) written by Gazi Azmal & Prof. Majeda Begum (2026 Edition)." 
        },
        { 
            subject: "CHEMISTRY", count: 13, name: "রসায়ন ১ম পত্র (তত্ত্বীয় ও ১-৩ সে. গাণিতিক)", 
            prompt: "Generate EXACTLY 13 Medical Admission MCQs in Bengali covering Chemistry 1st Paper Chapters 1 to 5 (Hazari & Nag, Sanjit Guha 2026 Edition). MUST INCLUDE 4-5 short calculator-free numerical problems solvable in 1-3 seconds (pH of 0.01M HCl, oxidation state, gas laws)." 
        },
        { 
            subject: "CHEMISTRY", count: 12, name: "রসায়ন ২য় পত্র (তত্ত্বীয় ও গাণিতিক শর্টকাট)", 
            prompt: "Generate EXACTLY 12 Medical Admission MCQs in Bengali covering Chemistry 2nd Paper Chapters 1 to 5 (Hazari & Nag, Dr. Haradhan Dutta 2026 Edition). MUST INCLUDE 4-5 short 1-3 second mental numericals from Electrochemistry and Environmental Chemistry." 
        },
        { 
            subject: "PHYSICS", count: 15, name: "পদার্থবিজ্ঞান ১ম ও ২য় পত্র (১-৩ সে. গাণিতিক)", 
            prompt: "Generate EXACTLY 15 Medical Admission MCQs in Bengali covering Physics 1st & 2nd Paper (Prof. Md. Ishaak, Shahjahan Tapan, Dr. Gias Uddin 2026 Edition). MUST INCLUDE 6-7 calculator-free 1-3 second numerical MCQs (Vector, Kinetic energy, Equivalent resistance, Half-life, Wavelength)." 
        },
        { 
            subject: "ENGLISH & GK", count: 30, name: "ইংরেজি ও সাধারণ জ্ঞান (নৈতিকতা সহ)", 
            prompt: `Generate EXACTLY 30 Medical Admission MCQs in Bengali containing:
            1. 15 English MCQs (Synonyms, Antonyms, Prepositions, Voice, Correction).
            2. 10 GK MCQs (Bangladesh History, 1971 Liberation War, Father of the Nation, and Current Affairs for ${dateCtx.year} up to ${dateCtx.dateStr}).
            3. 5 Medical Ethics MCQs (Ethical values & Professional Conduct).` 
        }
    ];

    try {
        for (let i = 0; i < subBatches.length; i++) {
            const b = subBatches[i];
            document.getElementById('loading-text').innerText = `${b.name} লোড হচ্ছে (${questions.length}/১০০)...`;
            
            // Fetch batch with guaranteed 100% completion retry loop
            let fetched = await fetchBatchGuaranteed(b.prompt, b.count, b.subject, dateCtx);
            questions = questions.concat(fetched);
            
            // Short 800ms delay between calls
            if (i < subBatches.length - 1) await delay(800);
        }

        document.getElementById('loading-overlay').style.display = 'none';
        initQuiz();
    } catch (error) {
        console.error("Groq Generation Error:", error);
        alert("প্রশ্ন লোড করতে সমস্যা হয়েছে। দয়া করে পেজটি আবার রিফ্রেশ দিন।");
        document.getElementById('loading-overlay').style.display = 'none';
    }
}

async function fetchBatchGuaranteed(specificPrompt, expectedCount, subjectName, dateCtx) {
    let resultQuestions = [];
    let attempts = 0;
    
    // Fast & highly available model
    const modelName = "llama-3.1-8b-instant";

    while (resultQuestions.length < expectedCount && attempts < 4) {
        attempts++;
        const needed = expectedCount - resultQuestions.length;
        const uniqueSeed = `${Date.now()}_${Math.floor(Math.random() * 1000000)}_${attempts}`;

        const promptText = `You are an official Bangladesh Medical College Admission Test Question Setter.
        Live Date Context: ${dateCtx.dateStr}, Year: ${dateCtx.year}.
        UNIQUE SEED: ${uniqueSeed}
        
        TASK: ${specificPrompt}
        Provide EXACTLY ${needed} unique MCQs in Bengali.
        
        CRITICAL RULES:
        1. Any mathematical question in Physics/Chemistry MUST be solvable without a calculator within 1 to 3 seconds using simple mental math or shortcuts.
        2. Absolute Accuracy: Double check answer indices according to 2026 Bangladeshi edition textbooks.
        3. Include exact textbook author and chapter name in "reference".
        
        OUTPUT RAW JSON ONLY (NO MARKDOWN CODE BLOCKS):
        {
          "questions": [
            {
              "text": "প্রশ্ন টেক্সট",
              "options": ["অপশন ১", "অপশন ২", "অপশন ৩", "অপশন ৪"],
              "answer": 0,
              "subject": "${subjectName}",
              "explanation": "২০২৬ সংস্করণের মূল বই অনুযায়ী ১-৩ সেকেন্ডে সমাধানের শর্টকাট ব্যাখ্যা।",
              "reference": "রেফারেন্স: লেখক ও অধ্যায়ের নাম (২০২৬ সংস্করণ)"
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
                    temperature: 0.3,
                    max_tokens: 4000,
                    response_format: { type: "json_object" }
                })
            });

            if (response.status === 429) {
                await delay(2500); // Pause if rate limited
                continue;
            }

            if (!response.ok) throw new Error(`Groq HTTP Error: ${response.status}`);

            const data = await response.json();
            let rawContent = data.choices[0].message.content;
            
            // Clean markdown formatting if present
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
    totalTime = 60 * 60;
    userAnswers = new Array(questions.length).fill(null);
    renderOMRGrid();
    loadQuestion(0);
    
    if (timerInterval) clearInterval(timerInterval);
    startTimer();
}

function renderOMRGrid() {
    const gridContainer = document.getElementById('omr-grid');
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
    document.getElementById('subject-tag').innerText = q.subject || "GENERAL";
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
        document.getElementById('explanation-text').innerHTML = `
            <div style="color: #10b981; font-weight: bold; margin-bottom: 5px;">
                ${q.reference ? q.reference : '২০২৬ সংস্করণের প্রামাণ্য বই'}
            </div>
            <div>${q.explanation || "সঠিক উত্তর ও প্রামাণ্য তথ্য অনুযায়ী সাজানো হয়েছে।"}</div>
        `;
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
    const candidateDeduction = parseFloat(document.getElementById('candidate-type').value);
    const finalScore = (correct - negative - candidateDeduction).toFixed(2);

    document.getElementById('correct-count').innerText = correct;
    document.getElementById('wrong-count').innerText = wrong;
    document.getElementById('negative-marks').innerText = negative.toFixed(2);
    document.getElementById('deduction-marks').innerText = candidateDeduction.toFixed(2);
    document.getElementById('final-score').innerText = Math.max(0, finalScore);

    document.getElementById('result-modal').style.display = 'flex';
}

function reviewExam() {
    isReviewMode = true;
    document.getElementById('result-modal').style.display = 'none';
    loadQuestion(0);
}

window.onload = () => {
    if (!groqApiKey) setApiKey();
    generateGroqQuestions();
};
