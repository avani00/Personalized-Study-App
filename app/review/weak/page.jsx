import StepScreen from "@/app/components/StepScreen";

export default function WeakTopicsPage() {
  return (
    <StepScreen
      breadcrumb={[
        { label: "Home", href: "/" },
        { label: "Review old", href: "/review" },
        { label: "Weak topics" },
      ]}
      title="Retry weak topics"
      subtitle="Focus practice on topics you've struggled with."
      blocks={["[ Weak topics list placeholder ]"]}
      actions={[
        { label: "← Back", href: "/review" },
        { label: "Practice weak topics →", href: "/upload/questions", primary: true },
      ]}
    />
  );
}
