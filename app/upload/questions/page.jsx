import StepScreen from "@/app/components/StepScreen";

export default function QuestionsPage() {
  return (
    <StepScreen
      breadcrumb={[
        { label: "Home", href: "/" },
        { label: "Upload new", href: "/upload/source" },
        { label: "Questions" },
      ]}
      title="Question screen"
      subtitle="Step 5 of 6 — Answer generated questions one at a time."
      blocks={[
        "[ Question text placeholder ]",
        "[ Answer input placeholder ]",
        "[ Hint (revealable) placeholder ]",
      ]}
      actions={[
        { label: "Hint", href: "/upload/questions" },
        { label: "Skip", href: "/upload/questions" },
        { label: "Submit", href: "/upload/questions" },
        { label: "Finish → Results", href: "/upload/results", primary: true },
      ]}
    />
  );
}
