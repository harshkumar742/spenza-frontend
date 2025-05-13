import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './Dashboard.css';

export enum SourceSystem {
  STRIPE = "https://api.stripe.com",
  SHOPIFY = "https://api.shopify.com",
  RAZORPAY = "https://api.razorpay.com",
  GITHUB = "https://api.github.com",
  SLACK = "https://slack.com/api"
}

const eventTypes = ['order.created', 'order.cancelled', 'user.updated', 'payment.failed'];

function Dashboard() {
  const [hooks, setHooks] = useState([]);
  const [events, setEvents] = useState([]);
  const [sourceUrl, setSourceUrl] = useState('');
  const [callbackUrl, setCallbackUrl] = useState('');
  const [eventType, setEventType] = useState(eventTypes[0]);
  const [payload, setPayload] = useState('{ "orderId": "12345", "amount": 1000 }');
  const navigate = useNavigate();

  useEffect(() => {
    fetchWebhooks();
    fetchEvents();
  }, []);

  const fetchWebhooks = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('http://localhost:8000/api/webhook/list', {
        headers: { Authorization: 'Bearer ' + token },
      });
      setHooks(res.data);
    } catch {
      toast.error('Failed to fetch webhooks');
    }
  };

  const fetchEvents = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('http://localhost:8000/api/webhook/sent', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEvents(res.data);
    } catch (err: any) {
      toast.error(`Failed to fetch events: ${err.response?.data?.error || err.message}`);
    }
  };

  const isValidUrl = (url: string) => {
    const pattern = /^(https?:\/\/)([\w-]+\.)+[\w-]{2,}(\/.*)?$/;
    return pattern.test(url.trim());
  };

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValidUrl(callbackUrl)) {
      toast.error('Invalid callback URL');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.post(
        'http://localhost:8000/api/webhook/subscribe',
        { sourceUrl, callbackUrl },
        { headers: { Authorization: 'Bearer ' + token } }
      );
      toast.success('Webhook subscribed');
      setCallbackUrl('');
      fetchWebhooks();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Subscription failed');
    }
  };

  const handleSimulate = async () => {
    try {
      const token = localStorage.getItem('token');
      const parsedPayload = JSON.parse(payload);
      await axios.post('http://localhost:8000/api/simulate', {
        sourceUrl,
        eventType,
        payload: parsedPayload
      }, { headers: { Authorization: 'Bearer ' + token } });
      toast.success('Webhook simulated');
      fetchEvents();
    } catch (err: any) {
      if (err.name === 'SyntaxError') {
        toast.error('Invalid JSON payload');
      } else {
        toast.error(err.response?.data?.error || 'Simulation failed');
      }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/');
  };

  return (
    <div className="dashboard">
      <ToastContainer position="top-right" autoClose={3000} />
      <div className="dashboard-header">
        <button onClick={handleLogout}>Logout</button>
      </div>

      <div className="dashboard-grid">
        {/* Subscribe */}
        <form onSubmit={handleSubscribe} className="section">
          <h3>Subscribe To Webhook</h3>

          <label>Source URL</label>
          <select value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} required>
            <option value="">-- Select Source --</option>
            {Object.values(SourceSystem).map((url) => (
              <option key={url} value={url}>{url}</option>
            ))}
          </select>

          <label>Callback URL</label>
          <input
            type="text"
            value={callbackUrl}
            placeholder="https://your-app.com/webhook"
            onChange={(e) => setCallbackUrl(e.target.value)}
            required
          />

          <button type="submit">Subscribe</button>
        </form>

        {/* Simulate */}
        <div className="section">
          <h3>Simulate Sending Event</h3>

          <label>Source URL</label>
          <select value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} required>
            <option value="">-- Select Source --</option>
            {Object.values(SourceSystem).map((url) => (
              <option key={url} value={url}>{url}</option>
            ))}
          </select>

          <label>Event Type</label>
          <select value={eventType} onChange={(e) => setEventType(e.target.value)}>
            {eventTypes.map((event) => (
              <option key={event} value={event}>{event}</option>
            ))}
          </select>

          <label>Payload (JSON)</label>
          <textarea
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
            rows={4}
          />

          <button onClick={handleSimulate}>Simulate</button>
        </div>

        {/* Webhook List */}
        <div className="section">
          <h3>Your Webhooks</h3>
          {hooks.length === 0 ? (
            <p>No subscriptions yet.</p>
          ) : (
            <ul className="webhook-list">
              {hooks.map((hook: any) => (
                <li key={hook._id}>
                  {hook.sourceUrl} → {hook.callbackUrl}
                  {hook.active !== false && (
                    <button
                      style={{ marginLeft: '10px', background: '#dc3545', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}
                      onClick={async () => {
                        try {
                          const token = localStorage.getItem('token');
                          await axios.post('http://localhost:8000/api/webhook/cancel', {
                            webhookId: hook._id
                          }, {
                            headers: { Authorization: 'Bearer ' + token }
                          });
                          toast.success('Webhook cancelled');
                          fetchWebhooks();
                        } catch (err: any) {
                          toast.error(err.response?.data?.error || 'Failed to cancel');
                        }
                      }}
                    >
                      Cancel
                    </button>
                  )}
                </li>
              ))}
            </ul>

          )}
        </div>

        {/* Webhook Events */}
        <div className="section">
          <h3>Webhook Events</h3>
          {events.length === 0 ? (
            <p>No events received yet.</p>
          ) : (
            <ul className="webhook-list">
              {events.map((event: any, index: number) => (
                <li key={index}>
                  <b>{event.eventType}</b> from {event.sourceUrl} → {event.callbackUrl}<br />
                  <span style={{ fontSize: '12px' }}>
                    Status: <span style={{ color: event.status === 'success' ? 'green' : 'red' }}>{event.status}</span> |
                    Retries: {event.attempts}
                  </span>
                </li>
              ))}
            </ul>

          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
