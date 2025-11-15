import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, XCircle, ExternalLink, RotateCcw, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Question {
  id: string;
  question: string;
  options: string[];
  correct_answer: string;
  difficulty: string;
  explanation: string;
  question_order: number;
}

interface Quiz {
  id: string;
  title: string;
  summary: string;
  wikipedia_url: string;
  key_entities: any;
  sections: string[];
  related_topics: string[];
}

interface QuizDisplayProps {
  quizId: string;
  onReset: () => void;
}

export const QuizDisplay = ({ quizId, onReset }: QuizDisplayProps) => {
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    loadQuiz();
  }, [quizId]);

  const loadQuiz = async () => {
    const { data: quizData } = await supabase
      .from('quizzes')
      .select('*')
      .eq('id', quizId)
      .single();

    const { data: questionsData } = await supabase
      .from('quiz_questions')
      .select('*')
      .eq('quiz_id', quizId)
      .order('question_order');

    if (quizData && questionsData) {
      setQuiz(quizData);
      // Parse the options from JSON to string array
      const parsedQuestions = questionsData.map(q => ({
        ...q,
        options: Array.isArray(q.options) ? q.options : JSON.parse(q.options as string)
      }));
      setQuestions(parsedQuestions as Question[]);
    }
  };

  const currentQuestion = questions[currentQuestionIndex];

  const handleAnswerSelect = (answer: string) => {
    if (isAnswered) return;
    
    setSelectedAnswer(answer);
    setIsAnswered(true);

    if (answer === currentQuestion.correct_answer) {
      setScore(score + 1);
    }
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setSelectedAnswer(null);
      setIsAnswered(false);
    } else {
      completeQuiz();
    }
  };

  const completeQuiz = async () => {
    setIsComplete(true);
    
    // Save attempt to database
    await supabase.from('quiz_attempts').insert({
      quiz_id: quizId,
      score: score,
      total_questions: questions.length,
    });

    toast.success(`Quiz completed! Score: ${score}/${questions.length}`);
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-success text-success-foreground';
      case 'medium': return 'bg-accent text-accent-foreground';
      case 'hard': return 'bg-destructive text-destructive-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getOptionLabel = (index: number) => ['A', 'B', 'C', 'D'][index];

  if (!quiz || questions.length === 0) {
    return <div className="text-center py-12">Loading quiz...</div>;
  }

  if (isComplete) {
    const percentage = Math.round((score / questions.length) * 100);
    
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
        <Card className="p-8 text-center space-y-6 shadow-[var(--shadow-card)]">
          <Trophy className="w-20 h-20 mx-auto text-accent" />
          <div>
            <h2 className="text-4xl font-bold mb-2">Quiz Complete!</h2>
            <p className="text-2xl text-muted-foreground">
              You scored <span className="font-bold text-primary">{score}</span> out of{' '}
              <span className="font-bold">{questions.length}</span>
            </p>
            <p className="text-lg mt-2 text-muted-foreground">{percentage}% correct</p>
          </div>
          
          <Progress value={percentage} className="h-3" />
          
          <div className="flex gap-3 justify-center">
            <Button onClick={onReset} variant="outline" size="lg">
              <RotateCcw className="mr-2 h-5 w-5" />
              Generate New Quiz
            </Button>
            <Button 
              onClick={() => window.open(quiz.wikipedia_url, '_blank')}
              variant="default"
              size="lg"
            >
              <ExternalLink className="mr-2 h-5 w-5" />
              View Article
            </Button>
          </div>
        </Card>

        {quiz.related_topics && quiz.related_topics.length > 0 && (
          <Card className="p-6 shadow-[var(--shadow-card)]">
            <h3 className="font-semibold text-lg mb-3">Related Topics</h3>
            <div className="flex flex-wrap gap-2">
              {quiz.related_topics.map((topic, idx) => (
                <Badge key={idx} variant="secondary" className="text-sm py-1 px-3">
                  {topic}
                </Badge>
              ))}
            </div>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card className="p-6 shadow-[var(--shadow-card)]">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">{quiz.title}</h2>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => window.open(quiz.wikipedia_url, '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              View Article
            </Button>
          </div>
          
          <p className="text-muted-foreground leading-relaxed">{quiz.summary}</p>
          
          <div className="flex items-center justify-between pt-2">
            <div className="text-sm text-muted-foreground">
              Question {currentQuestionIndex + 1} of {questions.length}
            </div>
            <div className="text-sm font-medium">
              Score: <span className="text-primary">{score}</span>/{questions.length}
            </div>
          </div>
          
          <Progress value={(currentQuestionIndex / questions.length) * 100} className="h-2" />
        </div>
      </Card>

      <Card className="p-8 shadow-[var(--shadow-hover)] border-2">
        <div className="space-y-6">
          <div className="flex items-start justify-between gap-4">
            <h3 className="text-xl font-semibold leading-relaxed flex-1">
              {currentQuestion.question}
            </h3>
            <Badge className={getDifficultyColor(currentQuestion.difficulty)}>
              {currentQuestion.difficulty}
            </Badge>
          </div>

          <div className="space-y-3">
            {currentQuestion.options.map((option, index) => {
              const optionLetter = getOptionLabel(index);
              const isCorrect = optionLetter === currentQuestion.correct_answer;
              const isSelected = optionLetter === selectedAnswer;
              
              return (
                <button
                  key={index}
                  onClick={() => handleAnswerSelect(optionLetter)}
                  disabled={isAnswered}
                  className={`
                    w-full p-4 rounded-xl text-left transition-all border-2
                    ${!isAnswered ? 'hover:border-primary hover:shadow-md cursor-pointer' : 'cursor-default'}
                    ${isAnswered && isCorrect ? 'border-success bg-success/10' : ''}
                    ${isAnswered && isSelected && !isCorrect ? 'border-destructive bg-destructive/10' : ''}
                    ${!isAnswered && isSelected ? 'border-primary bg-primary/5' : 'border-border'}
                  `}
                >
                  <div className="flex items-center gap-3">
                    <span className={`
                      flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-semibold
                      ${isAnswered && isCorrect ? 'bg-success text-success-foreground' : ''}
                      ${isAnswered && isSelected && !isCorrect ? 'bg-destructive text-destructive-foreground' : ''}
                      ${!isAnswered ? 'bg-muted text-muted-foreground' : ''}
                    `}>
                      {optionLetter}
                    </span>
                    <span className="flex-1">{option}</span>
                    {isAnswered && isCorrect && (
                      <CheckCircle2 className="w-6 h-6 text-success flex-shrink-0" />
                    )}
                    {isAnswered && isSelected && !isCorrect && (
                      <XCircle className="w-6 h-6 text-destructive flex-shrink-0" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {isAnswered && (
            <div className="space-y-4 pt-4 border-t animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className={`p-4 rounded-xl ${selectedAnswer === currentQuestion.correct_answer ? 'bg-success/10 border border-success' : 'bg-destructive/10 border border-destructive'}`}>
                <p className="font-medium mb-2">
                  {selectedAnswer === currentQuestion.correct_answer ? '✓ Correct!' : '✗ Incorrect'}
                </p>
                <p className="text-sm leading-relaxed">{currentQuestion.explanation}</p>
              </div>

              <Button 
                onClick={handleNext}
                size="lg"
                className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90"
              >
                {currentQuestionIndex < questions.length - 1 ? 'Next Question' : 'Finish Quiz'}
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};