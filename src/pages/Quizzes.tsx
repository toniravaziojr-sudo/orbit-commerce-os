import { PageHeader } from "@/components/ui/page-header";
import { QuizList } from "@/components/quizzes";

export default function Quizzes() {
  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Quizzes"
        description="Crie quizzes interativos para capturar leads e engajar visitantes"
      />
      <QuizList />
    </div>
  );
}
