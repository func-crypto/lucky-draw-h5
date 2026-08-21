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

export interface AdminPrizeStats {
  id: number
  level: string
  name: string
  initialStock: number
  drawnStock: number
  remainingStock: number
}

export interface AdminStats {
  id: number
  slug: string
  name: string
  status: string
  participantCount: number
  totalStock: number
  drawnStock: number
  remainingStock: number
  prizes: AdminPrizeStats[]
}

export interface AdminDrawRecord {
  drawId: number
  openid: string
  prizeLevel: string
  prizeName: string
  drawnAt: string
}
