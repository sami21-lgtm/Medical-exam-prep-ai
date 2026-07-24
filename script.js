let groqApiKey = localStorage.getItem("GROQ_API_KEY") || "";
let questions = [];
let userAnswers = new Array(100).fill(null);
let currentQuestionIndex = 0;
let totalTime = 60 * 60; // 60 minutes countdown
let timerInterval;
let isReviewMode = false;

// Helper function for adding delay between API requests to prevent Rate Limits
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

    const batchConfigs = [
        { 
            name: "জীববিজ্ঞান (৩০টি প্রশ্ন - ২০২৬ সংস্করণ)", 
            prompt: `Generate 30 Medical Admission Level Biology MCQs in Bengali strictly based on 2026 edition textbooks:
            - Botany: Dr. Abul Hasan (ড. আবুল হাসান), Dr. Md. Abul Alim, Nitai Chandra.
            - Zoology: Gazi Azmal & Gazi Asmat (গাজী আজমল ও গাজী আসমত), Prof. Majeda Begum.`
        },
        { 
            name: "রসায়ন (২৫টি প্রশ্ন - ২০২৬ সংস্করণ)", 
            prompt: `Generate 25 Medical Admission Level Chemistry MCQs in Bengali strictly based on 2026 edition textbooks:
            - Hazari & Nag (হাজারী ও নাগ), Sanjit Kumar Guha (সঞ্জিত কুমার গুহা), Dr. Haradhan Dutta, Swapan Kumar Roy, Dr. Abdul Karim.`
        },
        { 
            name: "পদার্থবিজ্ঞান (১৫টি প্রশ্ন - ২০২৬ সংস্করণ)", 
            prompt: `Generate 15 Medical Admission Level Physics MCQs in Bengali strictly based on 2026 edition textbooks:
            - Prof. Md. Ishaak (প্রফেসর মো: ইসহাক), Shahjahan Tapan (শাহজাহান তপন), Dr. Gias Uddin.`
        },
        { 
            name: "ইংরেজি, সাম্প্রতিক সা.জ্ঞান ও মানবিক মূল্যবোধ (৩০টি প্রশ্ন)", 
            prompt: `Generate 30 MCQs in Bengali/English:
            - 15 English Grammar & Vocabulary items (Synonym/Antonym, Preposition, Correction, Voice, Narration).
            - 15 General Knowledge, Current Affairs (Year ${dateCtx.year}, facts up to ${dateCtx.dateStr}, Liberation War, Bangabandhu, Healthcare Achievements) & Ethical/Human Values (মানবিক গুণাবলী ও চিকিৎসা নৈতিকতা).`
        }
    ];

    try {
        for (let i = 0; i < batchConfigs.length; i++) {
            document.getElementById('loading-text').innerText = `${batchConfigs[i].name} তৈরি হচ্ছে (${i + 1}/৪)...`;
            
            // Add a 2-second delay between batches to respect Groq TPM rate limits
            if (i > 0) await delay(2000);

            let batchQuestions = await fetchGroqBatchWithRetry(batchConfigs[i].prompt, dateCtx);
            questions = questions.concat(batchQuestions);
        }

        document.getElementById('loading-overlay').style.display = 'none';
        initQuiz();
    } catch (error) {
        console.error("Groq API Error Details:", error);
        alert("Groq API থেকে প্রশ্ন প্রসেস করতে সমস্যা হয়েছে। দয়া করে কয়েক সেকেন্ড পর আবার চেষ্টা করুন।");
        document.getElementById('loading-overlay').style.display = 'none';
    }
}

// Resilient Fetch Logic with Retry & Fallback Model
async function fetchGroqBatchWithRetry(specificPrompt, dateCtx, attempt = 0) {
    const primaryModel = "llama-3.3-70b-versatile";
    const fallbackModel = "llama-3.1-8b-instant"; // High TPM limits fallback

    const currentModel = attempt > 1 ? fallbackModel : primaryModel;

    const promptText = `You are an expert Bangladesh Medical College Admission Test Question Setter.
    Live Date Context: ${dateCtx.dateStr}, Year: ${dateCtx.year}.
    
    Task Spec: ${specificPrompt}
    
    Requirements:
    1. Questions must be 100% accurate based on latest 2026 edition textbooks & recent facts.
    2. Keep explanations informative yet concise.
    
    CRITICAL: Output ONLY raw valid JSON matching this schema with NO markdown code block wrappers:
    {
      "questions": [
        {
          "text": "প্রশ্ন টেক্সট",
          "options": ["অপশন ১", "অপশন ২", "অপশন ৩", "অপশন ৪"],
          "answer": 0,
          "subject": "BIOLOGY",
          "explanation": "গাজী আজমল/হাজারী নাগ স্যার ২০২৬ সংস্করণ বই অনুযায়ী সঠিক উত্তর ও তার নিখুঁত ব্যাখ্যা।",
          "reference": "বই রেফারেন্স: ড. আবুল হাসান (২০২৬ সংস্করণ)"
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
                temperature: 0.3,
                max_tokens: 4096,
                response_format: { type: "json_object" }
            })
        });

        if (response.status === 429 && attempt < 3) {
            console.warn(`Rate limit hit (429). Retrying in 3 seconds... Attempt ${attempt + 1}`);
            await delay(3000);
            return await fetchGroqBatchWithRetry(specificPrompt, dateCtx, attempt + 1);
        }

        if (!response.ok) {
            throw new Error(`Groq HTTP Error status: ${response.status}`);
        }

        const data = await response.json();
        const parsedData = JSON.parse(data.choices[0].message.content);
        return parsedData.questions;

    } catch (err) {
        if (attempt < 2) {
            console.warn(`Error encountered. Trying fallback model... Attempt ${attempt + 1}`);
            await delay(2000);
            return await fetchGroqBatchWithRetry(specificPrompt, dateCtx, attempt + 1);
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
