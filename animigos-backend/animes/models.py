from django.db import models

class Anime(models.Model):
    mal_id = models.IntegerField(primary_key=True, help_text="ID oficial de MyAnimeList")
    title = models.CharField(max_length=300, db_index=True)
    title_english = models.CharField(max_length=300, blank=True, default='')
    title_japanese = models.CharField(max_length=300, blank=True, default='')
    synopsis = models.TextField(blank=True, default='')
    
    image_url = models.TextField(blank=True, default='')
    banner_url = models.TextField(blank=True, default='')
    
    score = models.DecimalField(max_digits=4, decimal_places=2, null=True, blank=True, db_index=True)
    scored_by = models.IntegerField(default=0)
    popularity = models.IntegerField(null=True, blank=True)
    rank = models.IntegerField(null=True, blank=True)
    
    # Métrica para el recomendador: Índice de polarización / controversia
    polarization_index = models.DecimalField(max_digits=4, decimal_places=2, default=0.00, db_index=True,
                                             help_text="Desviación típica histórica de calificaciones (0=consenso, >2.5=polarización)")
    
    episodes = models.IntegerField(null=True, blank=True)
    duration = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    status = models.CharField(max_length=50, blank=True, default='FINISHED')
    
    season = models.CharField(max_length=20, blank=True, default='')
    season_year = models.IntegerField(null=True, blank=True, db_index=True)
    
    studio = models.CharField(max_length=100, blank=True, default='')
    genres = models.JSONField(default=list, help_text="Lista de géneros como JSON array")
    type = models.CharField(max_length=30, blank=True, default='TV')
    airing_day = models.CharField(max_length=20, blank=True, default='')
    broadcast_time = models.CharField(max_length=50, blank=True, default='')
    
    last_synced_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Anime"
        verbose_name_plural = "Animes"
        ordering = ['-score', 'popularity']

    def __str__(self):
        return f"{self.title} ({self.mal_id})"


class AnimeRecommendation(models.Model):
    """
    Grafo de co-recomendaciones entre animes del dataset.
    Permite al recomendador sugerir candidatos afines a los gustos del grupo.
    """
    source = models.ForeignKey(Anime, on_delete=models.CASCADE, related_name='recommendations_from')
    target = models.ForeignKey(Anime, on_delete=models.CASCADE, related_name='recommendations_to')
    strength = models.IntegerField(default=1, help_text="Cantidad de votos de recomendación mutua de la comunidad")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Recomendación de Anime"
        verbose_name_plural = "Recomendaciones de Anime"
        unique_together = ('source', 'target')
        ordering = ['-strength']

    def __str__(self):
        return f"{self.source.title} -> {self.target.title} ({self.strength} votos)"


class AnimeScoreHistory(models.Model):
    """
    Registro histórico y evolutivo de calificaciones y métricas de cada anime.
    Soporta los cortes anuales del dataset (2018–2026) y las actualizaciones
    mensuales automáticas continuas.
    """
    anime = models.ForeignKey(Anime, on_delete=models.CASCADE, related_name='score_history')
    year = models.PositiveSmallIntegerField(db_index=True)
    month = models.PositiveSmallIntegerField(
        null=True, blank=True, db_index=True,
        help_text="Mes de la captura (1-12) o null para cortes consolidados anuales"
    )
    recorded_at = models.DateField(db_index=True, help_text="Fecha de referencia de la captura")
    score = models.DecimalField(max_digits=4, decimal_places=2, null=True, blank=True)
    scored_by = models.BigIntegerField(default=0)
    members = models.BigIntegerField(default=0)
    rank = models.IntegerField(null=True, blank=True)
    popularity = models.IntegerField(null=True, blank=True)
    favorites = models.IntegerField(null=True, blank=True)

    class Meta:
        verbose_name = "Histórico de Puntuación"
        verbose_name_plural = "Históricos de Puntuación"
        ordering = ['recorded_at']
        constraints = [
            models.UniqueConstraint(fields=['anime', 'recorded_at'], name='unique_anime_recorded_at')
        ]

    def __str__(self):
        period = f"{self.year}-{self.month:02d}" if self.month else str(self.year)
        return f"{self.anime_id} [{period}]: ★ {self.score or 'N/A'}"

