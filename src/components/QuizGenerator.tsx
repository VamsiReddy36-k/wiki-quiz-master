import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Loader2, BookOpen, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

const wikiUrlSchema = z.string()
  .url({ message: "Please enter a valid URL" })
  .refine(url => {
    try {
      const parsed = new URL(url);
      return parsed.hostname.endsWith('.wikipedia.org') && 
             (parsed.protocol === 'http:' || parsed.protocol === 'https:');
    } catch {
      return false;
    }
  }, { message: 'Must be a valid Wikipedia URL (e.g., https://en.wikipedia.org/wiki/...)' });

interface QuizGeneratorProps {
  onQuizGenerated: (quizId: string) => void;
}

export const QuizGenerator = ({ onQuizGenerated }: QuizGeneratorProps) => {
  const [url, setUrl] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!url.trim()) {
      toast.error("Please enter a Wikipedia URL");
      return;
    }

    const validation = wikiUrlSchema.safeParse(url);
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    setIsGenerating(true);
    try {
      // Call edge function to generate quiz
      const { data: quizData, error: functionError } = await supabase.functions.invoke(
        'generate-quiz',
        {
          body: { wikipediaUrl: url }
        }
      );

      if (functionError) throw functionError;

      // Store quiz in database
      const { data: quiz, error: quizError } = await supabase
        .from('quizzes')
        .insert({
          title: quizData.title,
          summary: quizData.summary,
          wikipedia_url: quizData.wikipedia_url,
          key_entities: quizData.key_entities,
          sections: quizData.sections,
          related_topics: quizData.related_topics,
        })
        .select()
        .single();

      if (quizError) throw quizError;

      // Store questions
      const questions = quizData.quiz.map((q: any, index: number) => ({
        quiz_id: quiz.id,
        question: q.question,
        options: q.options,
        correct_answer: q.answer,
        difficulty: q.difficulty,
        explanation: q.explanation,
        question_order: index,
      }));

      const { error: questionsError } = await supabase
        .from('quiz_questions')
        .insert(questions);

      if (questionsError) throw questionsError;

      toast.success("Quiz generated successfully!");
      onQuizGenerated(quiz.id);
      setUrl("");
    } catch (error: any) {
      console.error('Error generating quiz:', error);
      toast.error(error.message || "Failed to generate quiz. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card className="p-8 shadow-[var(--shadow-card)] bg-gradient-to-b from-card to-background border-border/50">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-2 text-primary">
            <BookOpen className="w-8 h-8" />
            <Sparkles className="w-6 h-6" />
          </div>
          <h2 className="text-3xl font-bold text-foreground">Generate AI Quiz</h2>
          <p className="text-muted-foreground text-lg">
            Enter any Wikipedia article URL and AI will create an interactive quiz
          </p>
        </div>

        <div className="space-y-4">
          <div className="relative">
            <Input
              type="url"
              placeholder="https://en.wikipedia.org/wiki/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
              className="h-14 text-lg pl-5 pr-5 rounded-xl border-2 focus-visible:ring-primary"
              disabled={isGenerating}
            />
          </div>

          <Button
            onClick={handleGenerate}
            disabled={isGenerating}
            size="lg"
            className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-primary to-secondary hover:opacity-90 transition-opacity rounded-xl"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Generating Quiz...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-5 w-5" />
                Generate Quiz
              </>
            )}
          </Button>
        </div>

        <div className="text-sm text-muted-foreground text-center space-y-2">
          <p>Example: https://en.wikipedia.org/wiki/Artificial_intelligence</p>
          <p className="text-xs">Quiz generation takes 10-30 seconds</p>
        </div>
      </div>
    </Card>
  );
};