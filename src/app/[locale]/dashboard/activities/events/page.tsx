'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, User, Dumbbell } from 'lucide-react';

export default function EventsPage() {
    const t = useTranslations('Classes'); // Using Classes translations for days, etc.
    const ct = useTranslations('Common');

    const [view, setView] = useState<'month' | 'week'>('month');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [classes, setClasses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchClasses();
    }, []);

    const fetchClasses = async () => {
        try {
            const res = await fetch('/api/classes');
            const data = await res.json();
            // Only show active classes in the calendar
            setClasses(data.filter((c: any) => c.Status === 0));
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Helper functions for date manipulation
    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const days = new Date(year, month + 1, 0).getDate();
        const firstDay = new Date(year, month, 1).getDay(); // 0 = Sun

        // Adjust firstDay to Monday-start (0 = Mon, 6 = Sun)
        const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1;

        const res = [];
        // Padding for previous month
        const prevMonthDays = new Date(year, month, 0).getDate();
        for (let i = adjustedFirstDay - 1; i >= 0; i--) {
            res.push({ date: new Date(year, month - 1, prevMonthDays - i), currentMonth: false });
        }
        // Current month
        for (let i = 1; i <= days; i++) {
            res.push({ date: new Date(year, month, i), currentMonth: true });
        }
        // Padding for next month (fill to 42 usually for 6 rows, or just 35/42)
        const remaining = 42 - res.length;
        for (let i = 1; i <= remaining; i++) {
            res.push({ date: new Date(year, month + 1, i), currentMonth: false });
        }
        return res;
    };

    const getDaysInWeek = (date: Date) => {
        const day = date.getDay(); // 0 = Sun
        const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is sunday
        const monday = new Date(date.setDate(diff));
        const res = []; // Make sure we create new Date objects

        // Reset date to monday because setDate mutates
        const current = new Date(monday);

        for (let i = 0; i < 7; i++) {
            res.push({ date: new Date(current), currentMonth: true }); // currentMonth irrelevant for week view but keeping shape
            current.setDate(current.getDate() + 1);
        }
        return res;
    };

    const calendarDays = view === 'month' ? getDaysInMonth(currentDate) : getDaysInWeek(currentDate);

    // Get events for a specific date
    const getEventsForDate = (date: Date) => {
        // Create local YYYY-MM-DD string to avoid UTC shifts
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;

        const dayOfWeek = date.getDay() === 0 ? 7 : date.getDay(); // 1=Mon, 7=Sun to match DB

        const events: any[] = [];

        classes.forEach(cls => {
            if (cls.EsEvento) {
                // One-time event
                if (cls.FechaEvento && cls.FechaEvento.startsWith(dateStr)) {
                    events.push({
                        ...cls,
                        type: 'event',
                        timeStart: cls.HoraInicio,
                        timeEnd: cls.HoraFin
                    });
                }
            } else {
                // Recurring class
                // Check if schedules has this day
                if (cls.Schedules && cls.Schedules.length > 0) {
                    cls.Schedules.forEach((sch: any) => {
                        if (parseInt(sch.Dia) === dayOfWeek) {
                            events.push({
                                ...cls,
                                ...sch, // time info from schedule (HoraInicio, HoraFin)
                                type: 'class',
                                timeStart: sch.HoraInicio,
                                timeEnd: sch.HoraFin
                            });
                        }
                    });
                }
            }
        });

        // Sort by time
        return events.sort((a, b) => (a.timeStart || '').localeCompare(b.timeStart || ''));
    };

    const navigate = (dir: 'prev' | 'next') => {
        const newDate = new Date(currentDate);
        if (view === 'month') {
            newDate.setMonth(newDate.getMonth() + (dir === 'next' ? 1 : -1));
        } else {
            newDate.setDate(newDate.getDate() + (dir === 'next' ? 7 : -7));
        }
        setCurrentDate(newDate);
    };

    const monthNames = [
        t('months.jan'), t('months.feb'), t('months.mar'), t('months.apr'), t('months.may'), t('months.jun'),
        t('months.jul'), t('months.aug'), t('months.sep'), t('months.oct'), t('months.nov'), t('months.dec')
    ];

    // Hardcoded for now if translations missing, ideally use Intl or 'months.1' logic
    const getMonthName = (d: Date) => d.toLocaleString('default', { month: 'long' });

    return (
        <div style={{ padding: '1rem', height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h1 className="neon-text" style={{ fontSize: '1.8rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <CalendarIcon size={32} />
                    {currentDate.getFullYear()} - {getMonthName(currentDate)}
                </h1>

                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div className="glass-card" style={{ padding: '0.25rem', display: 'flex', gap: '0.25rem' }}>
                        <button
                            onClick={() => setView('month')}
                            className={`btn-icon ${view === 'month' ? 'active' : ''}`}
                            style={{
                                padding: '0.5rem 1rem',
                                background: view === 'month' ? 'var(--neon-blue)' : 'transparent',
                                color: view === 'month' ? 'black' : 'white',
                                borderRadius: '6px',
                                border: 'none',
                                fontWeight: '600'
                            }}
                        >
                            Month
                        </button>
                        <button
                            onClick={() => setView('week')}
                            className={`btn-icon ${view === 'week' ? 'active' : ''}`}
                            style={{
                                padding: '0.5rem 1rem',
                                background: view === 'week' ? 'var(--neon-blue)' : 'transparent',
                                color: view === 'week' ? 'black' : 'white',
                                borderRadius: '6px',
                                border: 'none',
                                fontWeight: '600'
                            }}
                        >
                            Week
                        </button>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={() => navigate('prev')} className="btn-icon">
                            <ChevronLeft size={24} />
                        </button>
                        <button onClick={() => { setCurrentDate(new Date()) }} className="btn-icon" style={{ fontSize: '0.9rem' }}>
                            Today
                        </button>
                        <button onClick={() => navigate('next')} className="btn-icon">
                            <ChevronRight size={24} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Calendar Grid */}
            <div className="glass-card" style={{ flex: 1, padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* Days Header */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                        <div key={day} style={{ padding: '1rem', textAlign: 'center', fontWeight: 'bold', color: 'var(--neon-blue)' }}>
                            {t(`days.${day === 'Mon' ? 1 : day === 'Tue' ? 2 : day === 'Wed' ? 3 : day === 'Thu' ? 4 : day === 'Fri' ? 5 : day === 'Sat' ? 6 : 7}`) || day}
                        </div>
                    ))}
                </div>

                {/* Days Cells */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(7, 1fr)',
                    gridAutoRows: '1fr',
                    flex: 1,
                    overflowY: 'auto'
                }}>
                    {calendarDays.map((dayObj, idx) => {
                        const events = getEventsForDate(dayObj.date);
                        const isToday = dayObj.date.toDateString() === new Date().toDateString();

                        return (
                            <div key={idx} style={{
                                borderRight: '1px solid rgba(255,255,255,0.05)',
                                borderBottom: '1px solid rgba(255,255,255,0.05)',
                                padding: '0.5rem',
                                background: !dayObj.currentMonth && view === 'month' ? 'rgba(0,0,0,0.3)' : 'transparent',
                                minHeight: view === 'month' ? '120px' : '100%',
                                display: 'flex', flexDirection: 'column', gap: '0.25rem',
                                overflow: 'hidden'
                            }}>
                                <div style={{
                                    textAlign: 'right',
                                    marginBottom: '0.5rem',
                                    color: isToday ? 'var(--neon-blue)' : 'inherit',
                                    fontWeight: isToday ? 'bold' : 'normal'
                                }}>
                                    <span style={{
                                        display: 'inline-block',
                                        width: '24px', height: '24px',
                                        lineHeight: '24px', textAlign: 'center',
                                        background: isToday ? 'rgba(0, 243, 255, 0.2)' : 'transparent',
                                        borderRadius: '50%'
                                    }}>
                                        {dayObj.date.getDate()}
                                    </span>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', overflowY: 'auto', maxHeight: '100%' }}>
                                    {events.map((evt, eIdx) => (
                                        <div key={eIdx} style={{
                                            background: evt.type === 'event' ? 'rgba(255, 68, 68, 0.2)' : 'rgba(0, 243, 255, 0.1)',
                                            borderLeft: `3px solid ${evt.type === 'event' ? '#ff4444' : 'var(--neon-blue)'}`,
                                            padding: '0.25rem 0.5rem',
                                            borderRadius: '4px',
                                            fontSize: '0.75rem',
                                            cursor: 'pointer',
                                            display: 'flex', gap: '0.5rem', alignItems: 'center'
                                        }} title={`${evt.Clase} - ${evt.Instructor}`}>
                                            {/* Photo */}
                                            {evt.ArchivoImagen && (
                                                <div style={{ width: '20px', height: '20px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
                                                    <img src={evt.ArchivoImagen} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                </div>
                                            )}

                                            <div style={{ overflow: 'hidden' }}>
                                                <div style={{ fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {evt.Clase}
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: 0.7, fontSize: '0.7rem' }}>
                                                    <Clock size={10} />
                                                    <span>{evt.timeStart && evt.timeStart.substring(0, 5)} - {evt.timeEnd && evt.timeEnd.substring(0, 5)}</span>
                                                </div>
                                                {evt.Instructor && (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: 0.7, fontSize: '0.7rem' }}>
                                                        <User size={10} />
                                                        <span>{evt.Instructor}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <style jsx>{`
                .btn-icon { 
                    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); 
                    color: white; padding: 0.5rem; borderRadius: 8px; cursor: pointer; transition: all 0.2s;
                    display: flex; align-items: center; justify-content: center;
                }
                .btn-icon:hover { background: rgba(0, 243, 255, 0.1); border-color: var(--neon-blue); color: var(--neon-blue); }
            `}</style>
        </div>
    );
}
