// api/twitch.js

import fetch from 'node-fetch';

export default async function handler(request, response) {
  // 1) Читаем параметр ?user= из URL
  const login = request.query.user; // например, "Cherrycraftpr"
  if (!login) {
    response.status(400).json({ error: 'missing user parameter' });
    return;
  }

  // 2) Считываем Client ID и App Access Token из переменных окружения Vercel
  const CLIENT_ID = process.env.TWITCH_CLIENT_ID;
  const ACCESS_TOKEN = process.env.TWITCH_ACCESS_TOKEN;
  if (!CLIENT_ID || !ACCESS_TOKEN) {
    response.status(500).json({
      error: 'server misconfiguration',
      detail: 'TWITCH_CLIENT_ID or TWITCH_ACCESS_TOKEN not set'
    });
    return;
  }

  // Объект debug для отладки (можно удалить в финальной версии)
  const debug = {
    getUser: 'not started',
    getFollows: 'not started'
  };

  try {
    //----------------------------------
    // 3) Шаг 1: Получаем ID пользователя по логину
    //    Helix endpoint: GET /helix/users?login=<login>
    //----------------------------------
    const userUrl = `https://api.twitch.tv/helix/users?login=${encodeURIComponent(login)}`;
    const userResp = await fetch(userUrl, {
      headers: {
        'Client-ID': CLIENT_ID,
        'Authorization': `Bearer ${ACCESS_TOKEN}`
      }
    });
    debug.getUser = `status ${userResp.status}`;
    if (!userResp.ok) {
      response
        .status(userResp.status)
        .json({ error: 'failed to fetch user data', detail: debug });
      return;
    }
    const userJson = await userResp.json();
    if (!userJson.data || userJson.data.length === 0) {
      response
        .status(404)
        .json({ error: 'user not found', detail: debug });
      return;
    }
    const userId = userJson.data[0].id; // Например, "123456789"

    //----------------------------------
    // 4) Шаг 2: Получаем число подписчиков (followers)
    //    Helix endpoint: GET /helix/users/follows?to_id=<userId>
    //----------------------------------
    const followsUrl = `https://api.twitch.tv/helix/users/follows?to_id=${userId}`;
    const followsResp = await fetch(followsUrl, {
      headers: {
        'Client-ID': CLIENT_ID,
        'Authorization': `Bearer ${ACCESS_TOKEN}`
      }
    });
    debug.getFollows = `status ${followsResp.status}`;
    if (!followsResp.ok) {
      response
        .status(followsResp.status)
        .json({ error: 'failed to fetch follows data', detail: debug });
      return;
    }
    const followsJson = await followsResp.json();
    // В Helix-ответе поле total содержит общее количество подписчиков
    if (typeof followsJson.total === 'number') {
      return response.status(200).json({ followerCount: followsJson.total });
    } else {
      return response
        .status(500)
        .json({ error: 'unexpected follows response', detail: followsJson });
    }
  } catch (err) {
    //----------------------------------
    // 5) Обрабатываем любые другие ошибки
    //----------------------------------
    return response.status(500).json({
      error: 'internal error',
      details: err.message,
      debug: debug
    });
  }
}
