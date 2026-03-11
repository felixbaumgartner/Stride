window.API = (() => {
  async function request(url, options = {}) {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error || 'Request failed');
    }
    return res.json();
  }

  return {
    // Tasks
    getTasks(date) { return request(`/api/tasks?from=${date}`); },
    createTask(body) { return request('/api/tasks', { method: 'POST', body }); },
    updateTask(id, body) { return request(`/api/tasks/${id}`, { method: 'PUT', body }); },
    toggleTask(id, completed) { return request(`/api/tasks/${id}/complete`, { method: 'PATCH', body: { completed } }); },
    deleteTask(id) { return request(`/api/tasks/${id}`, { method: 'DELETE' }); },

    // Ideas
    getIdeas(all = false) { return request(`/api/ideas${all ? '?all=1' : ''}`); },
    createIdea(body) { return request('/api/ideas', { method: 'POST', body }); },
    updateIdea(id, body) { return request(`/api/ideas/${id}`, { method: 'PUT', body }); },
    deleteIdea(id) { return request(`/api/ideas/${id}`, { method: 'DELETE' }); },
    convertIdea(id, date) { return request(`/api/ideas/${id}/convert`, { method: 'POST', body: { date } }); },

    // Principles
    getPrinciples() { return request('/api/principles'); },
    createPrinciple(body) { return request('/api/principles', { method: 'POST', body }); },
    updatePrinciple(id, body) { return request(`/api/principles/${id}`, { method: 'PUT', body }); },
    deletePrinciple(id) { return request(`/api/principles/${id}`, { method: 'DELETE' }); },

    // Vision
    getVision() { return request('/api/vision'); },
    createVision(body) { return request('/api/vision', { method: 'POST', body }); },
    updateVision(id, body) { return request(`/api/vision/${id}`, { method: 'PUT', body }); },
    deleteVision(id) { return request(`/api/vision/${id}`, { method: 'DELETE' }); },

    // Summary
    getSummary(week) { return request(`/api/summary${week ? '?week=' + week : ''}`); },

    // Search
    search(query) { return request(`/api/search?q=${encodeURIComponent(query)}`); },

    // Export
    async exportMarkdown() {
      const res = await fetch('/api/export');
      if (!res.ok) throw new Error('Export failed');
      return res.blob();
    }
  };
})();
