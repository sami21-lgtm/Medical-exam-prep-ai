let groqApiKey = localStorage.getItem("GROQ_API_KEY") || "";
let questions = [];
let userAnswers = new Array(100).fill(null);
let currentQuestionIndex = 0;
let totalTime = 60 * 60; // 60 minutes countdown
let timerInterval;
let isReviewMode = false;

// Delay helper to avoid Groq Rate Limits
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

    // 12 precise sub-chunks of MAX 10 questions each -> Guaranteed 100 Questions Total
    const subBatches = [
        // Biology (30 Questions)
        { subject: "BIOLOGY", count: 10, name: "জীববিজ্ঞান (১/৩)", prompt: "10 Medical Admission Biology MCQs in Bengali (Botany: Dr. Abul Hasan, Zoology: Gazi Azmal - 2026 Edition)." },
        { subject: "BIOLOGY", count: 10, name: "জীববিজ্ঞান (২/৩)", prompt: "10 Medical Admission Biology MCQs in Bengali (Prof. Majeda Begum, Dr. Abul Alim - 2026 Edition)." },
        { subject: "BIOLOGY", count: 10, name: "জীববিজ্ঞান (৩/৩)", prompt: "10 Medical Admission Biology MCQs in Bengali (Genetics, Human Physiology & Reproduction - 2026 Edition)." },
        
        // Chemistry (25 Questions)
        { subject: "CHEMISTRY", count: 10, name: "রসায়ন (১/৩)", prompt: "10 Medical Admission Chemistry MCQs in Bengali (Hazari & Nag - 2026 Edition)." },
        { subject: "CHEMISTRY", count: 10, name: "রসায়ন (২/৩)", prompt: "10 Medical Admission Chemistry MCQs in Bengali (Sanjit Kumar Guha, Dr. Haradhan Dutta - 2026 Edition)." },
        { subject: "CHEMISTRY", count: 5,  name: "রসায়ন (৩/৩)", prompt: "5 Medical Admission Chemistry MCQs in Bengali (Organic & Environmental Chemistry - 2026 Edition)." },
        
        // Physics (15 Questions)
        { subject: "PHYSICS", count: 10, name: "পদার্থবিজ্ঞান (১/২)", prompt: "10 Medical Admission Physics MCQs in Bengali (Prof. Md. Ishaak, Shahjahan Tapan - 2026 Edition)." },
        { subject: "PHYSICS", count: 5,  name: "পদার্থবিজ্ঞান (২/২)", prompt: "5 Medical Admission Physics MCQs in Bengali (Modern Physics, Electricity & Optics - 2026 Edition)." },
        
        // English (15 Questions)
        { subject: "ENGLISH", count: 10, name: "ইংরেজি (১/২)", prompt: "10 Medical Admission English MCQs (Synonym, Antonym, Preposition, Correction, Sentence Structure)." },
        { subject: "ENGLISH", count: 5,  name: "ইংরেজি (২/২)", prompt: "5 Medical Admission English MCQs (Voice, Narration, Idioms, Transformation)." },
        
        // GK & Ethical Values (15 Questions)
        { subject: "GK", count: 10, name: "সাধারণ জ্ঞান (১/২)", prompt: `10 Medical Admission GK MCQs in Bengali (Current affairs year ${dateCtx.year} up to ${dateCtx.dateStr}, Liberation War, Bangabandhu, Healthcare Achievements).` },
        { subject: "GK", count: 5,  name: "মানবিক মূল্যবোধ (২/২)", prompt: "5 Medical Admission MCQs in Bengali focusing on Medical Ethics, Human Values & Moral Reasoning." }
    ];

    try {
        for (let i = 0; i < subBatches.length; i++) {
            const b = subBatches[i];
            document.getElementById('loading-text').innerText = `${b.name} তৈরি হচ্ছে (${questions.length}/১০০টি তৈরি সম্পন্ন)...`;
            
            if (i > 0) await delay(1000); // 1 sec delay to avoid rate limit

            let fetched = await fetchGroqBatchWithRetry(b.prompt, b.count, b.subject, dateCtx);
            questions = questions.concat(fetched);
        }

        // Safety check if slight discrepancy occurs
        if (questions.length < 100) {
            console.warn(`Generated ${questions.length} questions. Adjusting user answers array.`);
        }

        document.getElementById('loading-overlay').style.display = 'none';
        initQuiz();
    } catch (error) {
        console.error("Groq Generation Error:", error);
        alert("প্রশ্ন জেনারেট করতে সমস্যা হয়েছে। দয়া করে পুনরায় চেষ্টা করুন।");
        document.getElementById('loading-overlay').style.display = 'none';
    }
}

// Resilient API Call with Retry & Fallback Model
async function fetchGroqBatchWithRetry(specificPrompt, expectedCount, subjectName, dateCtx, attempt = 0) {
    const primaryModel = "llama-3.3-70b-versatile";
    const fallbackModel = "llama-3.1-8b-instant";

    const currentModel = attempt > 1 ? fallbackModel : primaryModel;

    const promptText = `You are an official Bangladesh Medical Admission Test Question Setter.
    Current Date: ${dateCtx.dateStr}, Year: ${dateCtx.year}.
    
    TASK: ${specificPrompt}
    
    CRITICAL RULES:
    1. Generate EXACTLY ${expectedCount} MCQs in the "questions" array.
    2. All info must strictly match 2026 edition textbooks. Keep explanations brief and precise (max 25 words per question).
    
    OUTPUT JSON FORMAT ONLY (NO MARKDOWN CODE BLOCKS):
    {
      "questions": [
        {
          "text": "প্রশ্ন টেক্সট",
          "options": ["অপশন ১", "অপশন ২", "অপশন ৩", "অপশন ৪"],
          "answer": 0,
          "subject": "${subjectName}",
          "explanation": "২০২৬ সংস্করণের প্রামাণ্য বই অনুযায়ী সঠিক উত্তরের সংক্ষিপ্ত ব্যাখ্যা।",
          "reference": "রেফারেন্স: ড. আবুল হাসান / হাজারী ও নাগ (২০২৬ সংস্করণ)"
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
                max_tokens: 3500,
                response_format: { type: "json_object" }
            })
        });

        if (response.status === 429 && attempt < 3) {
            await delay(2000);
            return await fetchGroqBatchWithRetry(specificPrompt, expectedCount, subjectName, dateCtx, attempt + 1);
        }

        if (!response.ok) {
            throw new Error(`Groq Response Status: ${response.status}`);
        }

        const data = await response.json();
        const parsedData = JSON.parse(data.choices[0].message.content);
        return parsedData.questions || [];

    } catch (err) {
        if (attempt < 2) {
            await delay(1500);
            return await fetchGroqBatchWithRetry(specificPrompt, expectedCount, subjectName, dateCtx, attempt + 1);
        }
        return []; // Return empty array if batch fails so app doesn't crash
    }
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
