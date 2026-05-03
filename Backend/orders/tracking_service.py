"""
Bigship Logistics API integration.
Handles token caching and tracking timeline fetching.
"""
import logging
import requests
from django.core.cache import cache
from django.conf import settings

logger = logging.getLogger(__name__)

BIGSHIP_LOGIN_URL   = 'https://api.bigship.in/api/login/user'
BIGSHIP_TRACK_URL   = 'https://api.bigship.in/api/tracking'
TOKEN_CACHE_KEY     = 'bigship_token'
TOKEN_CACHE_SECONDS = 39600  # 11 hours (token expires in 12)

FALLBACK_TIMELINE = [
    {
        'timestamp': None,
        'status':    'Processing',
        'location':  '',
        'message':   'Tracking details will update shortly. Please check back later.',
    }
]


def get_bigship_token():
    """
    Return a valid Bigship bearer token.
    Checks cache first; fetches a new one if missing or expired.
    """
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
        data  = resp.json()
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
    """
    Fetch the tracking timeline for a given AWB number from Bigship.
    Returns a standardised list of event dicts, or FALLBACK_TIMELINE on error.
    """
    if not tracking_number:
        return FALLBACK_TIMELINE

    token = get_bigship_token()
    if not token:
        return FALLBACK_TIMELINE

    try:
        resp = requests.get(
            BIGSHIP_TRACK_URL,
            params={
                'tracking_type': 'awb',
                'tracking_id':   tracking_number,
            },
            headers={'Authorization': f'Bearer {token}'},
            timeout=10,
        )

        # Token may have expired mid-session — bust cache and retry once
        if resp.status_code == 401:
            cache.delete(TOKEN_CACHE_KEY)
            token = get_bigship_token()
            if not token:
                return FALLBACK_TIMELINE
            resp = requests.get(
                BIGSHIP_TRACK_URL,
                params={'tracking_type': 'awb', 'tracking_id': tracking_number},
                headers={'Authorization': f'Bearer {token}'},
                timeout=10,
            )

        if resp.status_code == 404:
            return FALLBACK_TIMELINE

        resp.raise_for_status()
        data           = resp.json()
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
        ]

        # Most recent event first
        return list(reversed(timeline))

    except requests.RequestException as exc:
        logger.error('Bigship tracking request failed for %s: %s', tracking_number, exc)
        return FALLBACK_TIMELINE