import Platform from "@/features/platform";
export default async function EventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <Platform initialEventId={id} />;
}
