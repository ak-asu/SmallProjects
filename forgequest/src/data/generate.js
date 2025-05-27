function generateMultiplicationPairs() {
  const pairs = [];
  for (let k = 0; k < 10; k++) {
    const i = Math.floor(Math.random() * 20) + 1;
    const j = Math.floor(Math.random() * 20) + 1;
    pairs.push([i, j]);
  }
  return pairs;
}

function generateDivisionPairs() {
  const pairs = [];
  for (let k = 0; k < 10; k++) {
    const i = Math.floor(Math.random() * 20) + 1;
    const j = Math.floor(Math.random() * 20) + 1;
    pairs.push([i * j, j]);
  }
  return pairs;
}

function generateEquation(size) {
  const divisionPairs = generateDivisionPairs();
  const multiplicationPairs = generateMultiplicationPairs();
  const randomInt = Math.floor(Math.random() * 5);
  let answer = 0;
  let question = '';
  for (let i = 0; i < size; i++) {
    if (randomInt === 0) {
      answer = answer + divisionPairs[i][0] / divisionPairs[i][1];
      question = `${question}+${divisionPairs[i][0]}/${divisionPairs[i][1]}`;
    } else if (randomInt === 1) {
      answer = answer + multiplicationPairs[i][0] * multiplicationPairs[i][1];
      question = `${question}+${multiplicationPairs[i][0]}*${multiplicationPairs[i][1]}`;
    } else if (randomInt === 2) {
      const tempNum = Math.floor(Math.random() * 50 + 1);
      answer = answer + tempNum;
      question = `${question}+${tempNum}`;
    } else if (randomInt === 3) {
      const tempNum = Math.floor(Math.random() * 50 + 1);
      answer = answer - tempNum;
      question = `${question}-${tempNum}`;
    } else if (randomInt === 4) {
      answer = answer - multiplicationPairs[i][0] * multiplicationPairs[i][1];
      question = `${question}-${multiplicationPairs[i][0]}*${multiplicationPairs[i][1]}`;
    } else {
      answer = answer - divisionPairs[i][0] / divisionPairs[i][1];
      question = `${question}-${divisionPairs[i][0]}/${divisionPairs[i][1]}`;      
    }
  }
  // Remove leading + if present
  let cleanedQuestion = question.replace(/^(\+)/, '');
  // If cleanedQuestion starts with '-', wrap in parentheses
  if (cleanedQuestion.startsWith('-')) {
    cleanedQuestion = `(${cleanedQuestion})`;
  }  
  return {
    question: cleanedQuestion,
    answer: answer,
  };
}

export function generateFinalEquation(difficulty) {
  const maxSize = 5;
  const maxDepth = 2;
  const maxSmallSize = 3;
  const size = Math.max(1, Math.ceil(difficulty * maxSize)) + 1;
  const depth = Math.max(1, Math.ceil(difficulty * maxDepth));
  const smallSize = Math.max(1, Math.floor(difficulty * maxSmallSize));
  let question = '';
  let answer = 0;
  for (let i = 0; i < size; i++) {
    const equation = generateEquation(smallSize);
    if (Math.random() < difficulty && depth > 1) {
      const subEquation = generateEquation(smallSize);
      if (Math.random() < 0.7) {
        question += `(${equation.question}+${subEquation.question})`;
        answer += equation.answer + subEquation.answer;
      } else {
        question += `(${equation.question}-${subEquation.question})`;
        answer += equation.answer - subEquation.answer;
      }
    } else {
      question += `${equation.question}`;
      answer += equation.answer;
    }
    if (i < size - 1) {
      question += '+';
    }
  }
  return {
    question: question,
    answer: answer,
  };
}