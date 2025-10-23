// --- DOM Elements ---
const modeSelect = document.getElementById('mode');
const levelSelect = document.getElementById('level');
const inputsContainer = document.getElementById('inputs-container');
const targetInput = document.getElementById('target');
const solveBtn = document.getElementById('solve-btn');
const resultsContainer = document.getElementById('results-container');
const solutionsDiv = document.getElementById('solutions');
const closestDiv = document.getElementById('closest-solution');
const noSolutionDiv = document.getElementById('no-solution');
const spinner = document.getElementById('spinner');

let solverWorker;

// --- Initial Setup ---
const updateInputs = () => {
    const numInputs = modeSelect.value === '4' ? 4 : 5;
    const targetLength = modeSelect.value === '4' ? 2 : 3;
    targetInput.placeholder = `${targetLength} หลัก`;
    inputsContainer.innerHTML = '';
    for (let i = 0; i < numInputs; i++) {
        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'num-input';
        input.placeholder = '#';
        inputsContainer.appendChild(input);
    }
};

modeSelect.addEventListener('change', updateInputs);
updateInputs();

// --- Main Solve Button Event ---
solveBtn.addEventListener('click', () => {
    // 1. Get and validate inputs
    const numbers = Array.from(inputsContainer.children)
        .map(input => parseInt(input.value))
        .filter(n => !isNaN(n));
    const target = parseInt(targetInput.value);
    const level = levelSelect.value;
    const numInputs = modeSelect.value === '4' ? 4 : 5;

    if (numbers.length !== numInputs || isNaN(target)) {
        alert('กรุณาป้อนข้อมูลให้ครบถ้วน');
        return;
    }
    
    // 2. Prepare UI for solving
    resultsContainer.classList.remove('hidden');
    solutionsDiv.innerHTML = '';
    closestDiv.classList.add('hidden');
    noSolutionDiv.classList.add('hidden');
    spinner.classList.remove('hidden');
    solveBtn.disabled = true;

    // --- Web Worker Logic ---
    if (solverWorker) {
        solverWorker.terminate();
    }
    solverWorker = new Worker('solver.js');
    solverWorker.postMessage({ numbers, target, level });

    solverWorker.onmessage = (e) => {
        const result = e.data;
        spinner.classList.add('hidden');
        solveBtn.disabled = false;
        displayResults(result);
        solverWorker.terminate(); 
    };
    
    solverWorker.onerror = (e) => {
        console.error('Error in solver worker:', e);
        spinner.classList.add('hidden');
        solveBtn.disabled = false;
        noSolutionDiv.classList.remove('hidden');
        noSolutionDiv.innerHTML = '<p>เกิดข้อผิดพลาดในการคำนวณ</p>';
    }
});

// --- Display Logic ---
const displayResults = (result) => {
    if (result.solutions.length > 0) {
        solutionsDiv.innerHTML = '<h3>วิธีที่เป็นไปได้ (เรียงตามความง่าย):</h3>';
        result.solutions.slice(0, 3).forEach((sol, index) => {
            const card = document.createElement('div');
            card.className = 'solution-card';
            if(index === 0) card.classList.add('best');
            try {
                katex.render(sol.str.replace(/\*/g, '\\times').replace(/\//g, '\\div'), card, {
                    throwOnError: false,
                    displayMode: true
                });
            } catch (e) {
                card.textContent = `${sol.str} = ${sol.value}`;
            }
            solutionsDiv.appendChild(card);
        });
    } else {
        if (result.closest.value !== Infinity) {
            closestDiv.classList.remove('hidden');
            closestDiv.innerHTML = `<h3>คำตอบที่ใกล้ที่สุด (จำนวนเต็ม):</h3>`;
            const card = document.createElement('div');
            card.className = 'solution-card best';
            try {
                katex.render(result.closest.str.replace(/\*/g, '\\times').replace(/\//g, '\\div'), card, {
                    throwOnError: false,
                    displayMode: true
                });
            } catch(e) {
                card.textContent = `${result.closest.str} = ${result.closest.value}`;
            }
            closestDiv.appendChild(card);
        } else {
            noSolutionDiv.classList.remove('hidden');
            noSolutionDiv.innerHTML = '<p>ไม่พบคำตอบที่เป็นไปได้</p>';
        }
    }
};
