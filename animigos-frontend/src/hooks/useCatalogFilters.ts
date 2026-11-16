import { useContext } from 'react'
import {
    CatalogFiltersContext,
    type CatalogFiltersContextValue,
} from '../context/CatalogFiltersContext'

export function useCatalogFilters(): CatalogFiltersContextValue {
    const context = useContext(CatalogFiltersContext)
    if (!context) {
        throw new Error('useCatalogFilters debe ser utilizado dentro de CatalogFiltersProvider')
    }
    return context
}
