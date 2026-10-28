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
    allowRecommendations?: boolean
}

export interface TmdbMovie {
    id: number
    title: string
    originalTitle?: string
    releaseYear?: string | number
    posterPath?: string
    genres: string[]
    overview: string
    voteAverage?: number
}

export interface TmdbAnimeRecommendation {
    animeId: number
    animeTitle: string
    animePoster: string
    animeScore: number
    animeStudio?: string
    genres: string[]
    matchedMovie: string
    matchReason: string
    affinityScore: number
}

export interface TasteTestAnswers {
    tropes: string[]
    favoriteGenres: string[]
    dislikedGenres: string[]
    pacing: string
    contentFilters: string[]
    favoriteMovies: TmdbMovie[]
    likedAnimeIds: number[]
    calibratedPercentage: number
}

export interface LateralWallpaperConfig {
    imageUrl: string
    opacity: number
    enabled: boolean
}

export interface FlagBannerConfig {
    imageUrl: string
    title?: string
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
