import logging
import requests
from django.core.cache import cache
from django.conf import settings

logger = logging.getLogger(__name__)

BIGSHIP_LOGIN_URL   = 'https://api.bigship.in/api/login/user'
BIGSHIP_TRACK_URL   = 'https://api.bigship.in/api/tracking'
TOKEN_CACHE_KEY     = 'bigship_token'
TOKEN_CACHE_SECONDS = 39600  # 11 hours

FALLBACK_TIMELINE = [
    {
        'timestamp': None,
        'status':    'Processing',
        'location':  '',
        'message':   'Tracking details will update shortly. Please check back later.',
    }
]


def get_bigship_token():
    token = cache.get(TOKEN_CACHE_KEY)
    if token:
        return token
    try:
        resp = requests.post(
            BIGSHIP_LOGIN_URL,
            json={
                'user_name':  settings.BIGSHIP_USERNAME,
                'password':   settings.BIGSHIP_PASSWORD,
                'access_key': settings.BIGSHIP_ACCESS_KEY,
            },
            timeout=10,
        )
        resp.raise_for_status()

        # Bug fix 1: resp.json() can return None if body is empty
        try:
            data = resp.json()
        except Exception:
            logger.error('Bigship login returned non-JSON response: %s', resp.text[:200])
            return None

        if data is None:
            logger.error('Bigship login returned null JSON body')
            return None

        # Bug fix 2: Bigship returns success:false with HTTP 200 — raise_for_status won't catch it
        if not data.get('success'):
            logger.error('Bigship login failed: %s', data.get('message', 'Unknown error'))
            return None

        token = data.get('data', {}).get('token')
        if not token:
            logger.error('Bigship login response missing token: %s', data)
            return None

        cache.set(TOKEN_CACHE_KEY, token, TOKEN_CACHE_SECONDS)
        return token

    except requests.RequestException as exc:
        logger.error('Bigship login request failed: %s', exc)
        return None


def get_bigship_tracking(tracking_number):
    if not tracking_number:
        return FALLBACK_TIMELINE

    token = get_bigship_token()
    if not token:
        logger.warning('No Bigship token available — returning fallback timeline')
        return FALLBACK_TIMELINE

    def _fetch(tkn):
        return requests.get(
            BIGSHIP_TRACK_URL,
            params={'tracking_type': 'awb', 'tracking_id': tracking_number},
            headers={'Authorization': f'Bearer {tkn}'},
            timeout=10,
        )

    try:
        resp = _fetch(token)

        # Bug fix 3: 401 auto-retry with fresh token
        if resp.status_code == 401:
            logger.warning('Bigship token expired, refreshing...')
            cache.delete(TOKEN_CACHE_KEY)
            token = get_bigship_token()
            if not token:
                return FALLBACK_TIMELINE
            resp = _fetch(token)

        if resp.status_code == 404:
            logger.info('Bigship AWB not found: %s', tracking_number)
            return FALLBACK_TIMELINE

        resp.raise_for_status()

        # Bug fix 4: safely parse JSON
        try:
            data = resp.json()
        except Exception:
            logger.error('Bigship tracking returned non-JSON: %s', resp.text[:200])
            return FALLBACK_TIMELINE

        if data is None:
            logger.error('Bigship tracking returned null JSON body')
            return FALLBACK_TIMELINE

        # Bug fix 5: check success flag before parsing data
        if not data.get('success'):
            logger.error('Bigship tracking failed: %s', data.get('message', 'Unknown error'))
            return FALLBACK_TIMELINE

        scan_histories = data.get('data', {}).get('scan_histories', [])
        if not scan_histories:
            return FALLBACK_TIMELINE

        timeline = [
            {
                'timestamp': event.get('scan_datetime'),
                'status':    event.get('scan_status')   or '',
                'location':  event.get('scan_location') or '',
                'message':   event.get('scan_remarks')  or '',
            }
            for event in scan_histories
            if isinstance(event, dict)  # Bug fix 6: guard against malformed entries
        ]

        return list(reversed(timeline)) if timeline else FALLBACK_TIMELINE

    except requests.RequestException as exc:
        logger.error('Bigship tracking request failed for %s: %s', tracking_number, exc)
        return FALLBACK_TIMELINE