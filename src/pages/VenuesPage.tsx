import { useState, type FormEvent } from 'react'
import Field from '../components/Field'
import { useEditMode } from '../lib/editMode'
import { deleteVenue, saveVenue, useVenues, type Venue } from '../lib/ledger'
import { useEditAction } from '../lib/useEditAction'

export default function VenuesPage() {
  const { canEdit } = useEditMode()
  const venues = useVenues()
  const action = useEditAction()
  // 正在編輯的場地；null 代表新增
  const [editing, setEditing] = useState<Venue | null>(null)

  if (venues.isLoading) return <p className="text-muted">載入中…</p>
  if (venues.error) return <p className="text-danger">讀取失敗：{venues.error.message}</p>

  function remove(venue: Venue) {
    if (!window.confirm(`刪除「${venue.name}」？舊活動的場地名稱不受影響。`)) return
    void action.run((password) => deleteVenue(password, venue.id))
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">常用場地</h1>
        <p className="text-sm text-muted">新增活動時可以直接點選；分享到 LINE 時會自動附上地圖連結。</p>
      </div>

      {action.error && (
        <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">
          {action.error}
        </p>
      )}

      {(venues.data ?? []).length === 0 ? (
        <p className="py-6 text-center text-faint">還沒有常用場地</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl bg-surface shadow-sm">
          {venues.data!.map((v) => (
            <li key={v.id} className="flex items-center gap-2 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p>📍 {v.name}</p>
                {v.map_url ? (
                  <a href={v.map_url} target="_blank" rel="noreferrer" className="block truncate text-xs text-accent-ink">
                    {v.map_url}
                  </a>
                ) : (
                  <p className="text-xs text-faint">沒有地圖連結</p>
                )}
              </div>
              {canEdit && (
                <>
                  <button
                    type="button"
                    onClick={() => setEditing(v)}
                    disabled={action.busy}
                    className="shrink-0 rounded-md px-2 py-1 text-xs text-muted active:bg-subtle disabled:opacity-40"
                  >
                    編輯
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(v)}
                    disabled={action.busy}
                    className="shrink-0 rounded-md px-2 py-1 text-xs text-danger active:bg-subtle disabled:opacity-40"
                  >
                    刪除
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <VenueForm key={editing?.id ?? 'new'} venue={editing} action={action} onDone={() => setEditing(null)} />
      )}

      <p className="text-xs text-faint">
        地圖連結：在 Google 地圖找到場地 → 分享 → 複製連結，貼到上面的欄位。
      </p>
    </div>
  )
}

function VenueForm({
  venue,
  action,
  onDone,
}: {
  venue: Venue | null
  action: ReturnType<typeof useEditAction>
  onDone: () => void
}) {
  const [name, setName] = useState(venue?.name ?? '')
  const [mapUrl, setMapUrl] = useState(venue?.map_url ?? '')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const url = mapUrl.trim()
    if (!name.trim()) return action.setError('請填寫場地名稱')
    if (url && !/^https?:\/\//.test(url)) return action.setError('地圖連結要是 https:// 開頭的網址')
    const ok = await action.run((password) => saveVenue(password, { id: venue?.id ?? null, name: name.trim(), mapUrl: url }))
    if (ok) {
      setName('')
      setMapUrl('')
      onDone()
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-3 rounded-xl bg-surface p-3 shadow-sm">
      <h2 className="font-semibold">{venue ? `編輯「${venue.name}」` : '新增場地'}</h2>
      <Field label="名稱" htmlFor="venue-name">
        <input
          id="venue-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={30}
          placeholder="例如：中正運動中心"
          className="w-full rounded-lg border border-line-strong px-3 py-2"
        />
      </Field>
      <Field label="Google 地圖連結（選填）" htmlFor="venue-url">
        <input
          id="venue-url"
          type="url"
          inputMode="url"
          value={mapUrl}
          onChange={(e) => setMapUrl(e.target.value)}
          maxLength={500}
          placeholder="https://maps.app.goo.gl/…"
          className="w-full rounded-lg border border-line-strong px-3 py-2"
        />
      </Field>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={action.busy}
          className="flex-1 rounded-lg bg-accent py-2 font-semibold text-on-accent disabled:opacity-50"
        >
          {action.busy ? '儲存中…' : venue ? '儲存' : '新增'}
        </button>
        {venue && (
          <button type="button" onClick={onDone} className="rounded-lg border border-line-strong px-4 py-2">
            取消
          </button>
        )}
      </div>
    </form>
  )
}
