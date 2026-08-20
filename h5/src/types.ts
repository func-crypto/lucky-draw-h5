export interface PrizeView {
  id: number
  level: string
  name: string
  imageUrl: string | null
  initialStock: number
  remainingStock: number
}

export interface ActivityView {
  id: number
  slug: string
  name: string
  status: string
  totalStock: number
  remainingStock: number
  prizes: PrizeView[]
}

export interface DrawResult {
  drawId: number
  prizeId: number
  prizeLevel: string
  prizeName: string
  prizeImageUrl: string | null
  drawnAt: string
  replayed: boolean
}
