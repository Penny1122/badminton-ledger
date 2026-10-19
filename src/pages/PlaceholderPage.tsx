export default function PlaceholderPage({ title }: { title: string }) {
  return (
    <div>
      <h1 className="text-xl font-bold">{title}</h1>
      <p className="mt-2 text-slate-500">施工中 🚧</p>
    </div>
  )
}
