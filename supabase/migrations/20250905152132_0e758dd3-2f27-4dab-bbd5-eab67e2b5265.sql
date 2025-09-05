-- Create database functions for Daily Challenge leaderboards

-- Daily leaderboard function
CREATE OR REPLACE FUNCTION get_daily_leaderboard(challenge_date DATE)
RETURNS TABLE(
    user_id UUID,
    display_name TEXT,
    score INTEGER,
    rank BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        dcr.user_id,
        COALESCE(p.display_name, 'Anonymous') as display_name,
        dcr.score,
        ROW_NUMBER() OVER (ORDER BY dcr.score DESC) as rank
    FROM daily_challenge_results dcr
    LEFT JOIN profiles p ON dcr.user_id = p.user_id
    WHERE dcr.challenge_date = get_daily_leaderboard.challenge_date
    ORDER BY dcr.score DESC
    LIMIT 100;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Weekly leaderboard function (Sunday to Saturday)
CREATE OR REPLACE FUNCTION get_weekly_leaderboard(week_start DATE)
RETURNS TABLE(
    user_id UUID,
    display_name TEXT,
    best_score INTEGER,
    rank BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        dcr.user_id,
        COALESCE(p.display_name, 'Anonymous') as display_name,
        MAX(dcr.score) as best_score,
        ROW_NUMBER() OVER (ORDER BY MAX(dcr.score) DESC) as rank
    FROM daily_challenge_results dcr
    LEFT JOIN profiles p ON dcr.user_id = p.user_id
    WHERE dcr.challenge_date >= week_start 
    AND dcr.challenge_date < week_start + INTERVAL '7 days'
    GROUP BY dcr.user_id, p.display_name
    ORDER BY MAX(dcr.score) DESC
    LIMIT 100;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Monthly leaderboard function
CREATE OR REPLACE FUNCTION get_monthly_leaderboard(year INTEGER, month INTEGER)
RETURNS TABLE(
    user_id UUID,
    display_name TEXT,
    best_score INTEGER,
    rank BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        dcr.user_id,
        COALESCE(p.display_name, 'Anonymous') as display_name,
        MAX(dcr.score) as best_score,
        ROW_NUMBER() OVER (ORDER BY MAX(dcr.score) DESC) as rank
    FROM daily_challenge_results dcr
    LEFT JOIN profiles p ON dcr.user_id = p.user_id
    WHERE EXTRACT(YEAR FROM dcr.challenge_date) = year
    AND EXTRACT(MONTH FROM dcr.challenge_date) = month
    GROUP BY dcr.user_id, p.display_name
    ORDER BY MAX(dcr.score) DESC
    LIMIT 100;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get current week start (Sunday)
CREATE OR REPLACE FUNCTION get_week_start(input_date DATE DEFAULT CURRENT_DATE)
RETURNS DATE AS $$
BEGIN
    RETURN input_date - INTERVAL '1 day' * EXTRACT(DOW FROM input_date);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;