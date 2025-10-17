import json
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from typing import Dict, Any
import re

def get_db_connection():
    dsn = os.environ.get('DATABASE_URL')
    return psycopg2.connect(dsn, cursor_factory=RealDictCursor)

def extract_youtube_id(url: str) -> str:
    patterns = [
        r'(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)',
        r'youtube\.com\/embed\/([^&\n?#]+)',
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return ''

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: ФырчТуб API для работы с видео, пользователями и комментариями
    Args: event - dict с httpMethod, body, queryStringParameters
          context - объект с request_id
    Returns: HTTP response dict
    '''
    method: str = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    conn = None
    cursor = None
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        if method == 'GET':
            params = event.get('queryStringParameters', {}) or {}
            action = params.get('action', 'videos')
            
            if action == 'videos':
                cursor.execute('''
                    SELECT v.*, u.username 
                    FROM videos v 
                    LEFT JOIN users u ON v.user_id = u.id 
                    ORDER BY v.created_at DESC
                ''')
                videos = cursor.fetchall()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'isBase64Encoded': False,
                    'body': json.dumps({'videos': videos}, default=str)
                }
            
            elif action == 'comments':
                video_id = params.get('video_id')
                cursor.execute('''
                    SELECT c.*, u.username 
                    FROM comments c 
                    LEFT JOIN users u ON c.user_id = u.id 
                    WHERE c.video_id = %s 
                    ORDER BY c.created_at DESC
                ''', (video_id,))
                comments = cursor.fetchall()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'isBase64Encoded': False,
                    'body': json.dumps({'comments': comments}, default=str)
                }
        
        elif method == 'POST':
            body_data = json.loads(event.get('body', '{}'))
            action = body_data.get('action')
            
            if action == 'register':
                username = body_data.get('username')
                password = body_data.get('password')
                
                cursor.execute('INSERT INTO users (username, password) VALUES (%s, %s) RETURNING id, username', 
                             (username, password))
                user = cursor.fetchone()
                conn.commit()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'isBase64Encoded': False,
                    'body': json.dumps({'success': True, 'user': user})
                }
            
            elif action == 'login':
                username = body_data.get('username')
                password = body_data.get('password')
                
                cursor.execute('SELECT id, username FROM users WHERE username = %s AND password = %s', 
                             (username, password))
                user = cursor.fetchone()
                
                if user:
                    return {
                        'statusCode': 200,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'isBase64Encoded': False,
                        'body': json.dumps({'success': True, 'user': user})
                    }
                else:
                    return {
                        'statusCode': 401,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'isBase64Encoded': False,
                        'body': json.dumps({'success': False, 'error': 'Неверный логин или пароль'})
                    }
            
            elif action == 'upload':
                user_id = body_data.get('user_id')
                title = body_data.get('title')
                youtube_url = body_data.get('youtube_url')
                youtube_id = extract_youtube_id(youtube_url)
                
                cursor.execute('''
                    INSERT INTO videos (user_id, title, youtube_url, youtube_id) 
                    VALUES (%s, %s, %s, %s) RETURNING id
                ''', (user_id, title, youtube_url, youtube_id))
                video_id = cursor.fetchone()['id']
                conn.commit()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'isBase64Encoded': False,
                    'body': json.dumps({'success': True, 'video_id': video_id})
                }
            
            elif action == 'comment':
                video_id = body_data.get('video_id')
                user_id = body_data.get('user_id')
                comment_text = body_data.get('comment_text')
                
                cursor.execute('''
                    INSERT INTO comments (video_id, user_id, comment_text) 
                    VALUES (%s, %s, %s) RETURNING id
                ''', (video_id, user_id, comment_text))
                conn.commit()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'isBase64Encoded': False,
                    'body': json.dumps({'success': True})
                }
        
        elif method == 'PUT':
            body_data = json.loads(event.get('body', '{}'))
            action = body_data.get('action')
            
            if action == 'react':
                video_id = body_data.get('video_id')
                user_id = body_data.get('user_id')
                reaction = body_data.get('reaction')
                
                cursor.execute('''
                    SELECT reaction_type FROM user_reactions 
                    WHERE video_id = %s AND user_id = %s
                ''', (video_id, user_id))
                existing = cursor.fetchone()
                
                if existing:
                    old_reaction = existing['reaction_type']
                    if old_reaction == reaction:
                        cursor.execute('DELETE FROM user_reactions WHERE video_id = %s AND user_id = %s', 
                                     (video_id, user_id))
                        if reaction == 'like':
                            cursor.execute('UPDATE videos SET likes = likes - 1 WHERE id = %s', (video_id,))
                        else:
                            cursor.execute('UPDATE videos SET dislikes = dislikes - 1 WHERE id = %s', (video_id,))
                    else:
                        cursor.execute('''
                            UPDATE user_reactions SET reaction_type = %s 
                            WHERE video_id = %s AND user_id = %s
                        ''', (reaction, video_id, user_id))
                        if old_reaction == 'like':
                            cursor.execute('UPDATE videos SET likes = likes - 1, dislikes = dislikes + 1 WHERE id = %s', 
                                         (video_id,))
                        else:
                            cursor.execute('UPDATE videos SET likes = likes + 1, dislikes = dislikes - 1 WHERE id = %s', 
                                         (video_id,))
                else:
                    cursor.execute('''
                        INSERT INTO user_reactions (video_id, user_id, reaction_type) 
                        VALUES (%s, %s, %s)
                    ''', (video_id, user_id, reaction))
                    if reaction == 'like':
                        cursor.execute('UPDATE videos SET likes = likes + 1 WHERE id = %s', (video_id,))
                    else:
                        cursor.execute('UPDATE videos SET dislikes = dislikes + 1 WHERE id = %s', (video_id,))
                
                conn.commit()
                
                cursor.execute('SELECT likes, dislikes FROM videos WHERE id = %s', (video_id,))
                stats = cursor.fetchone()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'isBase64Encoded': False,
                    'body': json.dumps({'success': True, 'likes': stats['likes'], 'dislikes': stats['dislikes']})
                }
        
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'Method not allowed'})
        }
    
    except psycopg2.Error as db_err:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': f'Database error: {str(db_err)}'})
        }
    except ValueError as val_err:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': f'Invalid input: {str(val_err)}'})
        }
    except BaseException as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': str(e)})
        }
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
