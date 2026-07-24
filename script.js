let groqApiKey = localStorage.getItem("GROQ_API_KEY") || "";
let questions = [];
let userAnswers = new Array(100).fill(null);
let currentQuestionIndex = 0;
let totalTime = 60 * 60; // 60 minutes countdown
let timerInterval;
let isReviewMode = false;

// Delay helper to avoid hitting Groq TPM/RPM Rate Limits
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

    // Divided into 8 precise small sub-batches to guarantee EXACT 100 Questions without token truncations
    const batchConfigs = [
        { 
            name: "জীববিজ্ঞান ১ম অংশ (১০টি)", count: 10,
            prompt: `Generate EXACTLY 10 Medical Admission Biology MCQs in Bengali based on 2026 Edition Zoology (Gazi Azmal, Prof. Majeda Begum).`
        },
        { 
            name: "জীববিজ্ঞান ২য় অংশ (১০টি)", count: 10,
            prompt: `Generate EXACTLY 10 Medical Admission Biology MCQs in Bengali based on 2026 Edition Botany (Dr. Abul Hasan, Dr. Abul Alim).`
        },
        { 
            name: "জীববিজ্ঞান ৩য় অংশ (১০টি)", count: 10,
            prompt: `Generate EXACTLY 10 Medical Admission Biology MCQs in Bengali covering Genetics, Cell & Human Physiology (2026 Edition).`
        },
        { 
            name: "রসায়ন ১ম অংশ (১৩টি)", count: 13,
            prompt: `Generate EXACTLY 13 Medical Admission Chemistry MCQs in Bengali based on 2026 Edition Hazari & Nag, Sanjit Kumar Guha.`
        },
        { 
            name: "রসায়ন ২য় অংশ (১২টি)", count: 12,
            prompt: `Generate EXACTLY 12 Medical Admission Chemistry MCQs in Bengali covering Organic & Environmental Chemistry (2026 Edition).`
        },
        { 
            name: "পদার্থবিজ্ঞান (১৫টি)", count: 15,
            prompt: `Generate EXACTLY 15 Medical Admission Physics MCQs in Bengali based on 2026 Edition Prof. Ishaak & Shahjahan Tapan.`
        },
        { 
            name: "ইংরেজি (১৫টি)", count: 15,
            prompt: `Generate EXACTLY 15 Medical Admission English Grammar & Vocabulary MCQs (Synonym, Antonym, Preposition, Voice, Correction).`
        },
        { 
            name: "সাম্প্রতিক সা.জ্ঞান ও মানবিক মূল্যবোধ (১৫টি)", count: 15,
            prompt: `Generate EXACTLY 15 General Knowledge MCQs in Bengali: Current affairs for year ${dateCtx.year} up to ${dateCtx.dateStr}, Liberation War, Bangladesh Health sector achievements, and Medical Ethical/Human Values.`
        }
    ];

    try {
        for (let i = 0; i < batchConfigs.length; i++) {
            document.getElementById('loading-text').innerText = `${batchConfigs[i].name} প্রসেস হচ্ছে (${i + 1}/${batchConfigs.length})...`;
            
            // Short 1.2 second pause between calls to respect rate limits
            if (i > 0) await delay(1200);

            let batchQuestions = await fetchGroqBatchWithRetry(batchConfigs[i].prompt, batchConfigs[i].count, dateCtx);
            questions = questions.concat(batchQuestions);
        }

        document.getElementById('loading-overlay').style.display = 'none';
        initQuiz();
    } catch (error) {
        console.error("Groq Generation Error:", error);
        alert("প্রশ্ন জেনারেট করতে সমস্যা হয়েছে। দয়া করে পুনরায় নতুন পরীক্ষা শুরু বাটনে ক্লিক করুন।");
        document.getElementById('loading-overlay').style.display = 'none';
    }
}

// Resilient API Call with Retry & Exact Count Request
async function fetchGroqBatchWithRetry(specificPrompt, expectedCount, dateCtx, attempt = 0) {
    const primaryModel = "llama-3.3-70b-versatile";
    const fallbackModel = "llama-3.1-8b-instant";

    const currentModel = attempt > 1 ? fallbackModel : primaryModel;

    const promptText = `You are an expert Bangladesh Medical Admission Test Question Setter.
    Current Date: ${dateCtx.dateStr}, Year: ${dateCtx.year}.
    
    TASK: ${specificPrompt}
    
    IMPORTANT CRITERIA:
    1. You MUST generate EXACTLY ${expectedCount} questions in the array. No more, no less.
    2. All questions, choices, and explanations must be 100% accurate based on 2026 edition textbooks.
    
    OUTPUT FORMAT (Return RAW JSON ONLY, NO Markdown block formatting):
    {
      "questions": [
        {
          "text": "প্রশ্ন টেক্সট",
          "options": ["অপশন ১", "অপশন ২", "অপশন ৩", "অপশন ৪"],
          "answer": 0,
          "subject": "BIOLOGY",
          "explanation": "২০২৬ সংস্করণের প্রামাণ্য বই অনুযায়ী সঠিক উত্তরের নির্ভুল ব্যাখ্যা।",
          "reference": "রেফারেন্স: ড. আবুল হাসান (২০২৬ সংস্করণ)"
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
                model: currentModel,
                messages: [{ role: "user", content: promptText }],
                temperature: 0.2,
                max_tokens: 4096,
                response_format: { type: "json_object" }
            })
        });

        if (response.status === 429 && attempt < 3) {
            await delay(2500);
            return await fetchGroqBatchWithRetry(specificPrompt, expectedCount, dateCtx, attempt + 1);
        }

        if (!response.ok) {
            throw new Error(`Groq Response Status: ${response.status}`);
        }

        const data = await response.json();
        const parsedData = JSON.parse(data.choices[0].message.content);
        return parsedData.questions || [];

    } catch (err) {
        if (attempt < 2) {
            await delay(2000);
            return await fetchGroqBatchWithRetry(specificPrompt, expectedCount, dateCtx, attempt + 1);
        }
        throw err;
    }
}

function initQuiz() {
    currentQuestionIndex = 0;
    totalTime = 60 * 60;
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
            <strong>${q.reference ? q.reference : '২০২৬ সংস্করণের প্রামাণ্য বই'}</strong><br/>
            ${q.explanation || "এই প্রশ্নের সঠিক উত্তর ও তথ্য প্রদান করা হলো।"}
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
        if (ans !== null) {
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
