window.API = (() => {
  async function request(url, options = {}) {
    const token = window.Auth?.getToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(url, {
      headers,
      ...options,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error || 'Request failed');
    }

    return res.json();
  }

  return {
    getTasks(date) {
      return request(`/api/tasks?from=${encodeURIComponent(date)}`);
    },
    getUnfinishedTasks() {
      return request('/api/tasks/unfinished');
    },
    getCarryover(beforeDate, within = 7) {
      return request(`/api/tasks/carryover?before=${encodeURIComponent(beforeDate)}&within=${within}`);
    },
    createTask(body) {
      return request('/api/tasks', { method: 'POST', body });
    },
    updateTask(id, body) {
      return request(`/api/tasks/${id}`, { method: 'PUT', body });
    },
    toggleTask(id, completed) {
      return request(`/api/tasks/${id}/complete`, { method: 'PATCH', body: { completed } });
    },
    setTaskFocus(id, focus) {
      return request(`/api/tasks/${id}/focus`, { method: 'PATCH', body: { focus } });
    },
    rescheduleTask(id, date) {
      return request(`/api/tasks/${id}/reschedule`, { method: 'POST', body: { date } });
    },
    deleteTask(id) {
      return request(`/api/tasks/${id}`, { method: 'DELETE' });
    },

    getIdeas({ includeConverted = false, includeArchived = false } = {}) {
      const params = new URLSearchParams();
      if (includeConverted) params.set('include_converted', '1');
      if (includeArchived) params.set('include_archived', '1');
      const query = params.toString();
      return request(`/api/ideas${query ? `?${query}` : ''}`);
    },
    createIdea(body) {
      return request('/api/ideas', { method: 'POST', body });
    },
    updateIdea(id, body) {
      return request(`/api/ideas/${id}`, { method: 'PUT', body });
    },
    archiveIdea(id, archived) {
      return request(`/api/ideas/${id}/archive`, { method: 'PATCH', body: { archived } });
    },
    starIdea(id, starred) {
      return request(`/api/ideas/${id}/star`, { method: 'PATCH', body: { starred } });
    },
    deleteIdea(id) {
      return request(`/api/ideas/${id}`, { method: 'DELETE' });
    },
    convertIdea(id, date) {
      return request(`/api/ideas/${id}/convert`, { method: 'POST', body: { date } });
    },

    getDocs(date) {
      const params = date ? `?date=${encodeURIComponent(date)}` : '';
      return request(`/api/docs${params}`);
    },
    createDoc(body) {
      return request('/api/docs', { method: 'POST', body });
    },
    updateDoc(id, body) {
      return request(`/api/docs/${id}`, { method: 'PUT', body });
    },
    deleteDoc(id) {
      return request(`/api/docs/${id}`, { method: 'DELETE' });
    },

    getPrinciples() {
      return request('/api/principles');
    },
    createPrinciple(body) {
      return request('/api/principles', { method: 'POST', body });
    },
    updatePrinciple(id, body) {
      return request(`/api/principles/${id}`, { method: 'PUT', body });
    },
    deletePrinciple(id) {
      return request(`/api/principles/${id}`, { method: 'DELETE' });
    },

    getVision() {
      return request('/api/vision');
    },
    createVision(body) {
      return request('/api/vision', { method: 'POST', body });
    },
    updateVision(id, body) {
      return request(`/api/vision/${id}`, { method: 'PUT', body });
    },
    deleteVision(id) {
      return request(`/api/vision/${id}`, { method: 'DELETE' });
    },

    getSummary({ week, date } = {}) {
      const params = new URLSearchParams();
      if (week) params.set('week', week);
      if (date) params.set('date', date);
      const query = params.toString();
      return request(`/api/summary${query ? `?${query}` : ''}`);
    },
    saveWeeklyReview(body) {
      return request('/api/summary/review', { method: 'PUT', body });
    },

    search(query) {
      return request(`/api/search?q=${encodeURIComponent(query)}`);
    },

    async exportMarkdown() {
      const token = window.Auth?.getToken();
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/export', { headers });
      if (!res.ok) throw new Error('Export failed');
      return res.blob();
    },
  };
})();
