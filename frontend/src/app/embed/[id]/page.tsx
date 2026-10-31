// [Member 5] Minimal iframe viewer
export default async function EmbedPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <h1>Embed {id}</h1>;
}
