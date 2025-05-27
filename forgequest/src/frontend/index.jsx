import React, { useState, useEffect, useMemo } from 'react';
import ForgeReconciler, { Heading, Button, Text, Stack, Textfield, Box, Inline } from '@forge/react';
import { invoke } from '@forge/bridge';
import { generateFinalEquation } from '../data/generate';

const App = () => {
  const [currentEquation, setCurrentEquation] = useState(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [timer, setTimer] = useState(30);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [startTime, setStartTime] = useState(null);
  const [endTime, setEndTime] = useState(null);
  const [bestScore, setBestScore] = useState(0);

  const difficulty = useMemo(() => {
    if (totalQuestions >= 20) return 1;
    return 0.1 + (totalQuestions / 20) * 0.9;
  }, [totalQuestions]);

  useEffect(() => {
    invoke('getBestScore').then(setBestScore);
  }, []);

  // Initialize first equation only once
  useEffect(() => {
    if (!currentEquation) {
      const equation = generateFinalEquation(0.1);
      setCurrentEquation(equation);
      setIsTimerActive(true);
      setStartTime(Date.now());
    }
  }, [currentEquation]);

  // Timer effect
  useEffect(() => {
    let interval = null;
    if (isTimerActive && timer > 0) {
      interval = setInterval(() => {
        setTimer(prevTimer => prevTimer - 1);
      }, 1000);
    } else if (timer === 0 && isTimerActive) {
      setIsTimerActive(false);
      setEndTime(Date.now());
      setFeedback(`Time's up! The correct answer was ${currentEquation?.answer?.toFixed(2)}`);
      if (totalQuestions > bestScore) {
        invoke('setBestScore', { score: totalQuestions }).then(() => {
          setBestScore(totalQuestions);
        });
      }      
      setShowResults(true);
    }
    return () => clearInterval(interval);
  }, [isTimerActive, timer, currentEquation, totalQuestions, bestScore]);

  const handleSubmit = () => {
    if (!userAnswer.trim()) return;
    setIsTimerActive(false);
    const isCorrect = parseFloat(userAnswer.trim()) === parseFloat(currentEquation.answer.toFixed(2));
    if (isCorrect) {
      setFeedback('Correct! Well done!');
      setTotalQuestions(totalQuestions + 1);
      // Add 5 seconds and automatically move to next question
      setTimeout(() => {
        const newEquation = generateFinalEquation(difficulty);
        setCurrentEquation(newEquation);
        setUserAnswer('');
        setShowResult(false);
        setFeedback('');
        setTimer(prevTimer => prevTimer + 5);
        setIsTimerActive(true);
      }, 1000);
    } else {
      setFeedback(`Incorrect. The correct answer is ${currentEquation.answer.toFixed(2)}`);
      setEndTime(Date.now());
      if (totalQuestions > bestScore) {
        invoke('setBestScore', { score: totalQuestions }).then(() => {
          setBestScore(totalQuestions);
        });
      }      
      setTimeout(() => {
        setShowResults(true);
      }, 2000);
    }
    setShowResult(true);
  };

  const handleRestart = () => {
    const equation = generateFinalEquation(0.1);
    setCurrentEquation(equation);
    setTotalQuestions(0);
    setUserAnswer('');
    setShowResult(false);
    setShowResults(false);
    setTimer(30);
    setFeedback('');
    setIsTimerActive(true);
    setStartTime(Date.now());
    setEndTime(null);
  };

  const getTimeTaken = () => {
    if (startTime && endTime) {
      return Math.round((endTime - startTime) / 1000);
    }
    return 0;
  };

  const getTimerColor = () => {
    if (timer > 16) return 'color.text.accent.green';
    if (timer > 8) return 'color.text.accent.yellow';
    return 'color.text.accent.red';
  };

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  return (
    <Box padding="space.300">
      {showResults ? (
        <Stack space="space.300" alignInline="center">
          <Heading as="h2">Game Over!</Heading>
          <Stack space="space.200" alignInline="center">
            <Text size="large">Equations Solved: {totalQuestions}</Text>
            <Text size="large">Time Taken: {formatTime(getTimeTaken())}</Text>
            <Text size="large">Best Score: {bestScore} equations</Text>
          </Stack>
          <Button appearance="primary" onClick={handleRestart}>
            Start New Game
          </Button>
        </Stack>
      ) : (
        <Stack space="space.300" alignInline="center">
          <Heading as="h2">Math Aptitude Quest</Heading>
          <Inline>
            <Text as="strong" size='large'>Time:&nbsp;</Text>
            <Text size='large' color={getTimerColor()}>{timer}</Text>
          </Inline>
          {currentEquation && (
            <Stack space="space.300" alignInline="center">
              <Text size="large">{currentEquation.question} = ?</Text>
              <Textfield
                label="Your Answer"
                value={userAnswer}
                onChange={(event) => setUserAnswer(event.target.value)}
                placeholder="Enter your answer..."
                isDisabled={showResult}
              />
              {!showResult ? (
                <Button
                  appearance="primary"
                  onClick={handleSubmit}
                  isDisabled={!userAnswer.trim()}
                >
                  Submit Answer
                </Button>
              ) : (
                <Text>{feedback}</Text>
              )}
            </Stack>
          )}
        </Stack>
      )}
    </Box >
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
