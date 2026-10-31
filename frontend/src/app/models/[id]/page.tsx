// [Member 5 & 6] Model detail + Embed Playground + Like/Comment/Buy
export default async function ModelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <h1>Model {id}</h1>;
}
