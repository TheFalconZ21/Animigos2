import os
import sys
import time
import json
import logging
from typing import List, Dict, Any
from django.core.management.base import BaseCommand
from animes.models import Anime

logger = logging.getLogger(__name__)

TRANSLATION_PROMPT = """Eres un traductor y editor literario experto en anime, manga y cultura japonesa.
Tu misión es traducir con alta calidad al español neutro las siguientes sinopsis de series y películas de anime que están en inglés.

Reglas estrictas de traducción:
1. Conserva intactos los nombres propios de personajes, ciudades, organizaciones y títulos (ej. Frieren, Himmel, Luffy, Soul Society, Edward Elric).
2. Mantén la terminología canónica de anime cuando corresponda (ej. Shinigami, Hokage, Sensei, Isekai, Nakama, Senpai, Mecha).
3. Adapta modismos en inglés a un español neutro, natural, cautivador y literario.
4. Responde ÚNICAMENTE con un arreglo JSON válido (sin explicaciones ni texto introductorio) con el siguiente formato exacto:
[
  {"id": <id_numerico>, "synopsis_es": "Texto traducido al español..."}
]

Lista de animes a traducir:
"""


class Command(BaseCommand):
    help = "Traduce sinopsis de los animes más populares del inglés al español usando Gemini 1.5 Flash (Opción A)."

    def add_arguments(self, parser):
        parser.add_argument(
            '--top',
            type=int,
            default=2000,
            help='Cantidad de animes del ranking superior a traducir (por defecto 2000)',
        )
        parser.add_argument(
            '--batch-size',
            type=int,
            default=10,
            help='Cantidad de sinopsis agrupadas por cada llamada a Gemini (por defecto 10)',
        )
        parser.add_argument(
            '--api-key',
            type=str,
            default='',
            help='Gemini API Key (si se omite, se lee de la variable GEMINI_API_KEY o del archivo .env)',
        )
        parser.add_argument(
            '--delay',
            type=float,
            default=4.0,
            help='Pausa en segundos entre llamadas para respetar el rate limit de 15 RPM de Gemini Free Tier (por defecto 4.0s)',
        )
        parser.add_argument(
            '--free',
            action='store_true',
            help='Usar motor de traducción libre alternativo (MyMemory) si no tienes API key de Gemini',
        )

    def handle(self, *args, **options):
        top_limit = options['top']
        batch_size = options['batch_size']
        api_key = options['api_key'] or os.environ.get('GEMINI_API_KEY') or os.environ.get('GOOGLE_API_KEY')
        delay = options['delay']
        use_free = options['free']

        if not api_key and not use_free:
            # Buscar en .env si no está en os.environ
            env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), '.env')
            if os.path.exists(env_path):
                with open(env_path, 'r', encoding='utf-8') as f:
                    for line in f:
                        line = line.strip()
                        if line.startswith('GEMINI_API_KEY='):
                            api_key = line.split('=', 1)[1].strip(' "\'')
                        elif line.startswith('GOOGLE_API_KEY='):
                            api_key = line.split('=', 1)[1].strip(' "\'')

        if not api_key and not use_free:
            self.stderr.write(self.style.ERROR(
                "=======================================================================\n"
                "Para ejecutar la OPCIÓN A con Gemini 1.5 Flash requieres una Gemini API Key.\n"
                "Puedes obtenerla gratis en menos de 1 minuto en:\n"
                "  👉 https://aistudio.google.com/app/apikey\n\n"
                "Y luego ejecutar:\n"
                "  python manage.py translate_synopses --top 2000 --api-key TU_CLAVE_AQUI\n"
                "o añadirla en animigos-backend/.env: GEMINI_API_KEY=tu_clave\n\n"
                "(Si prefieres probar ahora sin clave, puedes usar: --free)\n"
                "======================================================================="
            ))
            return

        model = None
        if not use_free:
            try:
                import google.generativeai as genai
                genai.configure(api_key=api_key)
                model = genai.GenerativeModel(
                    model_name='gemini-3.8-flash',
                    generation_config={
                        "response_mime_type": "application/json",
                        "temperature": 0.3,
                    }
                )
            except Exception as e:
                self.stderr.write(self.style.ERROR(f"Error inicializando cliente de Gemini: {e}"))
                return

        engine_name = "Gemini 1.5 Flash (Opción A)" if not use_free else "Motor Libre (MyMemory)"
        self.stdout.write(self.style.NOTICE(
            f"=== Iniciando traducción con {engine_name} para el Top {top_limit} animes ==="
        ))

        # 1. Seleccionar los top N animes por popularidad/relevancia que aún no tengan sinopsis en español
        top_animes_qs = Anime.objects.exclude(synopsis='').order_by('-scored_by', '-score')[:top_limit]
        candidate_ids = list(top_animes_qs.values_list('mal_id', flat=True))

        pending_animes = list(
            Anime.objects.filter(mal_id__in=candidate_ids, synopsis_es='')
            .only('mal_id', 'title', 'synopsis')
            .order_by('-scored_by')
        )

        total_pending = len(pending_animes)
        already_done = top_limit - total_pending

        self.stdout.write(
            f"Top {top_limit} animes: {len(candidate_ids)} analizados | "
            f"Ya traducidos en BD: {already_done} | Pendientes: {total_pending}"
        )

        if total_pending == 0:
            self.stdout.write(self.style.SUCCESS("¡Todos los animes del Top seleccionado ya tienen sinopsis en español!"))
            return

        success_count = 0
        fail_count = 0

        # MODO 1: Gemini 1.5 Flash (en lotes de 10)
        if model:
            for i in range(0, total_pending, batch_size):
                batch = pending_animes[i : i + batch_size]
                payload = [
                    {
                        "id": a.mal_id,
                        "title": a.title,
                        "synopsis": a.synopsis[:1400],
                    }
                    for a in batch
                ]

                prompt_content = TRANSLATION_PROMPT + json.dumps(payload, ensure_ascii=False, indent=2)

                translated_data: List[Dict[str, Any]] = []
                for attempt in range(1, 4):
                    try:
                        response = model.generate_content(prompt_content)
                        raw_text = response.text.strip()
                        if raw_text.startswith('```json'):
                            raw_text = raw_text.replace('```json', '', 1).rsplit('```', 1)[0].strip()
                        elif raw_text.startswith('```'):
                            raw_text = raw_text.replace('```', '', 1).rsplit('```', 1)[0].strip()

                        translated_data = json.loads(raw_text)
                        if isinstance(translated_data, list):
                            break
                    except Exception as e:
                        wait_sec = attempt * 7
                        self.stderr.write(self.style.WARNING(
                            f"Aviso en lote {i//batch_size + 1} (intento {attempt}/3): {e}. Reintentando en {wait_sec}s..."
                        ))
                        time.sleep(wait_sec)

                if not translated_data:
                    self.stderr.write(self.style.ERROR(f"Error: no se pudo traducir el lote {i//batch_size + 1}."))
                    fail_count += len(batch)
                    continue

                trans_map = {}
                for item in translated_data:
                    if isinstance(item, dict) and item.get('id') and item.get('synopsis_es'):
                        trans_map[item['id']] = item['synopsis_es'].strip()

                batch_updated = 0
                for a in batch:
                    new_syn = trans_map.get(a.mal_id)
                    if new_syn:
                        Anime.objects.filter(pk=a.mal_id).update(synopsis_es=new_syn)
                        batch_updated += 1

                success_count += batch_updated
                fail_count += (len(batch) - batch_updated)

                processed_total = i + len(batch)
                pct = (processed_total / total_pending) * 100
                self.stdout.write(self.style.SUCCESS(
                    f"[{processed_total}/{total_pending} ({pct:.1f}%)] Lote {i//batch_size + 1}: {batch_updated} sinopsis guardadas en la BD."
                ))

                if processed_total < total_pending and delay > 0:
                    time.sleep(delay)

        # MODO 2: Motor Libre (MyMemory fallback)
        else:
            from deep_translator import MyMemoryTranslator
            translator = MyMemoryTranslator(source='en-US', target='es-ES')

            for idx, a in enumerate(pending_animes, 1):
                try:
                    text_to_trans = a.synopsis[:450] # MyMemory limita longitud por segmento
                    translated = translator.translate(text_to_trans)
                    if translated and len(translated) > 10:
                        Anime.objects.filter(pk=a.mal_id).update(synopsis_es=translated.strip())
                        success_count += 1
                        pct = (idx / total_pending) * 100
                        self.stdout.write(f"[{idx}/{total_pending} ({pct:.1f}%)] {a.title} traducido.")
                    else:
                        fail_count += 1
                except Exception as e:
                    self.stderr.write(self.style.WARNING(f"Error traduciendo {a.title}: {e}"))
                    fail_count += 1
                time.sleep(0.3)

        self.stdout.write(self.style.SUCCESS(
            f"\n=== Proceso finalizado ===\n"
            f"Sinopsis traducidas y guardadas exitosamente: {success_count}\n"
            f"Omitidas / Fallidas: {fail_count}\n"
            f"Total de sinopsis en español en la BD: {Anime.objects.exclude(synopsis_es='').count()}"
        ))
