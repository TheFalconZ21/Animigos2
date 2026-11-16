import React, { createContext, useState } from 'react'

export interface CatalogFilterState {
    studio: string
    selectedTerms: string[]
    season: string
    year: string
    minScore: string
    format: string
    ordering: string
    noSequels: boolean
    notInMyList: boolean
    searchInput: string
    submittedSearch: string
    currentPage: number
}

export interface CatalogFiltersContextValue {
    filters: CatalogFilterState
    setFilters: React.Dispatch<React.SetStateAction<CatalogFilterState>>
    clearFilters: () => void
}

export const CatalogFiltersContext = createContext<CatalogFiltersContextValue | null>(null)

export const CatalogFiltersProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [filters, setFilters] = useState<CatalogFilterState>(() => ({
        studio: '',
        selectedTerms: [],
        season: '',
        year: '',
        minScore: '',
        format: '',
        ordering: '-score',
        noSequels: false,
        notInMyList: false,
        searchInput: '',
        submittedSearch: '',
        currentPage: 1,
    }))

    const clearFilters = () => {
        setFilters((current) => ({
            ...current,
            studio: '',
            selectedTerms: [],
            season: '',
            year: '',
            minScore: '',
            format: '',
            ordering: '-score',
            noSequels: false,
            notInMyList: false,
            searchInput: '',
            submittedSearch: '',
            currentPage: 1,
        }))
    }

    return (
        <CatalogFiltersContext.Provider value={{ filters, setFilters, clearFilters }}>
            {children}
        </CatalogFiltersContext.Provider>
    )
}
