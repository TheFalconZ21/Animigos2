export interface SocialLinks {
    mal?: string
    anilist?: string
    discord?: string
    twitter?: string
}

export interface PrivacyConfig {
    isListPublic: boolean
    showStats: boolean
    allowComments: 'everyone' | 'friends' | 'none'
}

export interface TasteTestAnswers {
    tropes: string[]
    favoriteGenres: string[]
    dislikedGenres: string[]
    pacing: string
    contentFilters: string[]
    calibratedPercentage: number
}

export interface ProfileComment {
    id: string
    authorId: string
    authorName: string
    authorUsername: string
    authorAvatar: string
    authorBadge?: string
    content: string
    hasSpoiler: boolean
    createdAt: string
    likes: number
    isLiked?: boolean
    replies?: ProfileCommentReply[]
}

export interface ProfileCommentReply {
    id: string
    authorName: string
    authorUsername: string
    authorAvatar: string
    content: string
    createdAt: string
}
