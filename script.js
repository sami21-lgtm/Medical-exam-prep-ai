let apiKey = localStorage.getItem("GEMINI_API_KEY") || "";
let questions = [];
let userAnswers = new Array(100).fill(null);
let currentQuestionIndex = 0;
let totalTime = 60 * 60; // 60 minutes
let timerInterval;

// Prompt user for Gemini API Key if missing
function setApiKey() {
    let key = prompt("আপনার Google Gemini API Key প্রবেশ করান (ফ্রি API Key ব্যবহার করতে পারবেন):", apiKey);
    if (key) {
        apiKey = key.trim();
        localStorage.setItem("GEMINI_API_KEY", apiKey);
        alert("API Key সফলভাবে সেভ হয়েছে!");
    }
}

// Unlimited 100 AI Questions Generator
async function generateUnlimitedQuestions() {
    if (!apiKey) {
        setApiKey();
        if (!apiKey) {
            alert("AI দিয়ে অনলিমিটেড নতুন প্রশ্ন জেনারেট করার জন্য API Key প্রয়োজন!");
            return;
        }
    }

    document.getElementById('loading-overlay').style.display = 'flex';
    document.getElementById('result-modal').style.display = 'none';
    
    questions = [];
    userAnswers = new Array(100).fill(null);

    try {
        // Generate in 4 batches of 25 questions to cleanly reach 100 questions
        for (let batch = 1; batch <= 4; batch++) {
            document.getElementById('loading-text').innerText = `AI প্রশ্ন জেনারেট করছে (${batch * 25}/১০০টি তৈরি হয়েছে)...`;
            let batchQuestions = await fetchAIBatchQuestions(batch);
            questions = questions.concat(batchQuestions);
        }

        document.getElementById('loading-overlay').style.display = 'none';
        initQuiz();
    } catch (error) {
        console.error(error);
        alert("AI প্রশ্ন তৈরি করতে সমস্যা হয়েছে। আবার চেষ্টা করুন বা API Key চেক করুন।");
        document.getElementById('loading-overlay').style.display = 'none';
    }
}

// API Call Engine
async function fetchAIBatchQuestions(batchNum) {
    const promptText = `Generate 25 distinct Bangladesh Medical Admission Test (MBBS/BDS) level MCQs in Bengali language.
    Subjects: Biology (Zoology/Botany), Chemistry, Physics, English, GK/Ethical values.
    Difficulty level: Easy, Medium, Hard mix.
    
    CRITICAL: Return ONLY a raw JSON array of objects without any markdown code block (no markdown, no \`\`\`json).
    Format:
    [
      {
        "text": "প্রশ্ন টেক্সট",
        "options": ["অপশন ১", "অপশন ২", "অপশন ৩", "অপশন ৪"],
        "answer": 0,
        "subject": "BIOLOGY"
      }
    ]`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            contents: [{ parts: [{ text: promptText }] }]
        })
    });

    const data = await response.json();
    let rawText = data.candidates[0].content.parts[0].text;
    rawText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(rawText);
}

// Initialize Exam Engine
function initQuiz() {
    currentQuestionIndex = 0;
    totalTime = 60 * 60;
    renderOMRGrid();
    loadQuestion(0);
    
    if (timerInterval) clearInterval(timerInterval);
    startTimer();
}

// Render OMR Buttons Grid (1 to 100)
function renderOMRGrid() {
    const gridContainer = document.getElementById('omr-grid');
    gridContainer.innerHTML = '';
    
    for (let i = 0; i < 100; i++) {
        const btn = document.createElement('button');
        btn.classList.add('omr-btn');
        btn.innerText = i + 1;
        btn.id = `omr-${i}`;
        btn.onclick = () => loadQuestion(i);
        gridContainer.appendChild(btn);
    }
}

// Load Question into UI
function loadQuestion(index) {
    currentQuestionIndex = index;
    const q = questions[index];
    
    document.getElementById('question-number').innerText = `প্রশ্ন নং: ${index + 1}/১০০`;
    document.getElementById('subject-tag').innerText = q.subject || "GENERAL";
    document.getElementById('question-text').innerHTML = marked.parse(q.text);
    
    const optionsContainer = document.getElementById('options-container');
    optionsContainer.innerHTML = '';
    
    const prefixes = ['A', 'B', 'C', 'D'];
    q.options.forEach((opt, optIndex) => {
        const btn = document.createElement('button');
        btn.classList.add('option-btn');
        if (userAnswers[index] === optIndex) btn.classList.add('selected');
        
        btn.innerHTML = `<span class="option-prefix">${prefixes[optIndex]}</span> <span>${opt}</span>`;
        btn.onclick = () => selectOption(optIndex);
        optionsContainer.appendChild(btn);
    });

    updateOMRHighlight();
}

// Handle Option Selection
function selectOption(optionIndex) {
    userAnswers[currentQuestionIndex] = optionIndex;
    const btns = document.querySelectorAll('.option-btn');
    btns.forEach((btn, idx) => {
        if (idx === optionIndex) btn.classList.add('selected');
        else btn.classList.remove('selected');
    });
    updateOMRHighlight();
}

// Update OMR Button Styles
function updateOMRHighlight() {
    for (let i = 0; i < 100; i++) {
        const omrBtn = document.getElementById(`omr-${i}`);
        if (omrBtn) {
            omrBtn.classList.remove('current', 'answered');
            if (userAnswers[i] !== null) omrBtn.classList.add('answered');
            if (i === currentQuestionIndex) omrBtn.classList.add('current');
        }
    }
}

function nextQuestion() {
    if (currentQuestionIndex < 99) loadQuestion(currentQuestionIndex + 1);
}

function prevQuestion() {
    if (currentQuestionIndex > 0) loadQuestion(currentQuestionIndex - 1);
}

// Timer Logic
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

// Submit Exam & Calculate Result
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
    const secondTimerDeduction = parseFloat(document.getElementById('second-timer-select').value);
    const finalScore = (correct - negative - secondTimerDeduction).toFixed(2);

    document.getElementById('correct-count').innerText = correct;
    document.getElementById('wrong-count').innerText = wrong;
    document.getElementById('negative-marks').innerText = negative.toFixed(2);
    document.getElementById('deduction-marks').innerText = secondTimerDeduction.toFixed(2);
    document.getElementById('final-score').innerText = Math.max(0, finalScore);

    document.getElementById('result-modal').style.display = 'flex';
}

window.onload = () => {
    if (!apiKey) setApiKey();
    generateUnlimitedQuestions();
};
