import { useState } from "react";
import { QuizGenerator } from "@/components/QuizGenerator";
import { QuizDisplay } from "@/components/QuizDisplay";
import { Brain, Sparkles } from "lucide-react";

const Index = () => {
  const [currentQuizId, setCurrentQuizId] = useState<string | null>(null);

  const handleQuizGenerated = (quizId: string) => {
    setCurrentQuizId(quizId);
  };

  const handleReset = () => {
    setCurrentQuizId(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
      <div className="container mx-auto px-4 py-8 sm:py-12">
        <header className="text-center mb-12 space-y-4">
          <div className="flex items-center justify-center gap-3">
            <Brain className="w-12 h-12 text-primary" />
            <h1 className="text-5xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              AI Wiki Quiz
            </h1>
            <Sparkles className="w-8 h-8 text-secondary" />
          </div>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Transform any Wikipedia article into an interactive quiz powered by AI
          </p>
        </header>

        <main>
          {!currentQuizId ? (
            <QuizGenerator onQuizGenerated={handleQuizGenerated} />
          ) : (
            <QuizDisplay quizId={currentQuizId} onReset={handleReset} />
          )}
        </main>

        <footer className="mt-16 text-center text-sm text-muted-foreground">
          <p>Powered by Lovable Cloud & Lovable AI</p>
        </footer>
      </div>
    </div>
  );
};

export default Index;