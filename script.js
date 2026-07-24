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

    // Guaranteed Chapter-by-Chapter Full Syllabus Prompt Array
    const subBatches = [
        // Botany Chapters 1-12
        { 
            subject: "BIOLOGY", count: 10, name: "উদ্ভিদবিজ্ঞান (অধ্যায় ১-১২)", 
            prompt: "Generate EXACTLY 10 Medical Admission MCQs in Bengali strictly from Botany Chapters 1 to 12 (Cell Structure, Cell Division, Microbes, Plant Physiology, Biotechnology, Genetics) written by Dr. Abul Hasan & Dr. Md. Abul Alim (2026 Edition). Ensure questions cover diverse chapters without skipping any." 
        },
        // Zoology Chapters 1-12
        { 
            subject: "BIOLOGY", count: 10, name: "প্রাণীবিজ্ঞান (অধ্যায় ১-১২)", 
            prompt: "Generate EXACTLY 10 Medical Admission MCQs in Bengali strictly from Zoology Chapters 1 to 12 (Animal Diversity, Hydra, Grasshopper, Human Physiology, Digestion, Circulation, Genetics) written by Gazi Azmal, Gazi Asmat & Prof. Majeda Begum (2026 Edition)." 
        },
        // Biology Mixed Chapters
        { 
            subject: "BIOLOGY", count: 10, name: "জীববিজ্ঞান রিভিশন ও গুরুত্বপূর্ণ অধ্যায়", 
            prompt: "Generate EXACTLY 10 Medical Admission Biology MCQs in Bengali selecting questions randomly across Botany & Zoology 1st and 2nd paper all chapters (2026 Edition)." 
        },
        
        // Chemistry 1st Paper Chapters 1-5
        { 
            subject: "CHEMISTRY", count: 10, name: "রসায়ন ১ম পত্র (অধ্যায় ১-৫)", 
            prompt: "Generate EXACTLY 10 Medical Admission MCQs in Bengali covering Chemistry 1st Paper Chapters 1 to 5 (Qualitative Chemistry, Periodic Properties, Chemical Change, Practical Chem) written by Hazari & Nag and Sanjit Kumar Guha (2026 Edition)." 
        },
        // Chemistry 2nd Paper Chapters 1-5
        { 
            subject: "CHEMISTRY", count: 10, name: "রসায়ন ২য় পত্র (অধ্যায় ১-৫)", 
            prompt: "Generate EXACTLY 10 Medical Admission MCQs in Bengali covering Chemistry 2nd Paper Chapters 1 to 5 (Environmental Chemistry, Organic Chemistry, Quantitative Chem, Electrochemistry) written by Hazari & Nag, Dr. Haradhan Dutta & Swapan Kumar Roy (2026 Edition)." 
        },
        // Chemistry Industry & Applied
        { 
            subject: "CHEMISTRY", count: 5, name: "রসায়ন বিশেষ প্রয়োগিক অধ্যায়", 
            prompt: "Generate EXACTLY 5 Medical Admission MCQs in Bengali from Industrial Chemistry, Polymer, and Food Chemistry chapters (2026 Edition)." 
        },
        
        // Physics 1st Paper Chapters 1-10
        { 
            subject: "PHYSICS", count: 8, name: "পদার্থবিজ্ঞান ১ম পত্র (অধ্যায় ১-১০)", 
            prompt: "Generate EXACTLY 8 Medical Admission MCQs in Bengali covering Physics 1st Paper Chapters 1 to 10 (Vectors, Dynamics, Gravitation, Waves, Ideal Gas) written by Prof. Md. Ishaak & Shahjahan Tapan (2026 Edition)." 
        },
        // Physics 2nd Paper Chapters 1-11
        { 
            subject: "PHYSICS", count: 7, name: "পদার্থবিজ্ঞান ২য় পত্র (অধ্যায় ১-১১)", 
            prompt: "Generate EXACTLY 7 Medical Admission MCQs in Bengali covering Physics 2nd Paper Chapters 1 to 11 (Thermodynamics, Current Electricity, Optics, Atomic Physics, Electronics) written by Dr. Gias Uddin & Prof. Ishaak (2026 Edition)." 
        },
        
        // English Grammar & Vocabulary
        { 
            subject: "ENGLISH", count: 10, name: "ইংরেজি গ্রামার ও ভোকাবুলারি", 
            prompt: "Generate EXACTLY 10 Medical Admission English MCQs focusing on Synonyms, Antonyms, Appropriate Prepositions, Subject-Verb Agreement, and Correction." 
        },
        { 
            subject: "ENGLISH", count: 5, name: "ইংরেজি ব্যবহারিক ও ট্রান্সফরমেশন", 
            prompt: "Generate EXACTLY 5 Medical Admission English MCQs focusing on Voice, Narration, Idioms & Phrases, and Sentence Transformation." 
        },
        
        // GK & Ethics
        { 
            subject: "GK", count: 10, name: "সাম্প্রতিক সা.জ্ঞান ও ইতিহাস", 
            prompt: `Generate EXACTLY 10 Medical Admission GK MCQs in Bengali covering Bangladesh History, 1971 Liberation War, Father of the Nation, and Live Current Affairs for year ${dateCtx.year} up to ${dateCtx.dateStr}.` 
        },
        { 
            subject: "GK", count: 5, name: "চিকিৎসা নৈতিকতা ও মানবিক গুণাবলী", 
            prompt: "Generate EXACTLY 5 Medical Admission MCQs in Bengali covering Medical Ethics, Human Values, Professional Conduct, and Empathy in Patient Care." 
        }
    ];

    try {
        for (let i = 0; i < subBatches.length; i++) {
            const b = subBatches[i];
            document.getElementById('loading-text').innerText = `${b.name} প্রস্তুত হচ্ছে (${questions.length}/১০০)...`;
            
            if (i > 0) await delay(1000);

            let fetched = await fetchGroqBatchWithRetry(b.prompt, b.count, b.subject, dateCtx);
            questions = questions.concat(fetched);
        }

        document.getElementById('loading-overlay').style.display = 'none';
        initQuiz();
    } catch (error) {
        console.error("Groq Generation Error:", error);
        alert("প্রশ্ন তৈরি করতে সমস্যা হয়েছে। নতুন পরীক্ষা শুরু বাটন চাপুন।");
        document.getElementById('loading-overlay').style.display = 'none';
    }
}

async function fetchGroqBatchWithRetry(specificPrompt, expectedCount, subjectName, dateCtx, attempt = 0) {
    const primaryModel = "llama-3.3-70b-versatile";
    const fallbackModel = "llama-3.1-8b-instant";
    const currentModel = attempt > 1 ? fallbackModel : primaryModel;

    const promptText = `You are an official Bangladesh Medical College Admission Test Question Setter.
    Live Date Context: ${dateCtx.dateStr}, Year: ${dateCtx.year}.
    
    TASK: ${specificPrompt}
    
    MANDATORY CRITERIA:
    1. Output EXACTLY ${expectedCount} questions in raw Bengali text.
    2. Information MUST be 100% textbook accurate based on specified 2026 edition authors.
    3. Include exact textbook author and chapter reference in the "reference" field (e.g. "রেফারেন্স: ড. আবুল হাসান (২০২৬ সংস্করণ) - ৫ম অধ্যায় (উদ্ভিদ শারীরতত্ত্ব)").
    
    JSON SCHEMA ONLY (NO MARKDOWN CODE BLOCK):
    {
      "questions": [
        {
          "text": "প্রশ্ন টেক্সট",
          "options": ["অপশন ১", "অপশন ২", "অপশন ৩", "অপশন ৪"],
          "answer": 0,
          "subject": "${subjectName}",
          "explanation": "২০২৬ সংস্করণের প্রামাণ্য বই ও নির্দিষ্ট অধ্যায় অনুযায়ী সঠিক ব্যাখ্যা।",
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

        if (!response.ok) throw new Error(`Groq Status: ${response.status}`);

        const data = await response.json();
        const parsedData = JSON.parse(data.choices[0].message.content);
        return parsedData.questions || [];

    } catch (err) {
        if (attempt < 2) {
            await delay(1500);
            return await fetchGroqBatchWithRetry(specificPrompt, expectedCount, subjectName, dateCtx, attempt + 1);
        }
        return [];
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
