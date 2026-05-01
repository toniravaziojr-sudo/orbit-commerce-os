DELETE FROM messages WHERE conversation_id='3a205d99-6941-4bec-af9c-c1abc13c42ad';
DELETE FROM conversation_events WHERE conversation_id='3a205d99-6941-4bec-af9c-c1abc13c42ad';
DELETE FROM conversations WHERE id='3a205d99-6941-4bec-af9c-c1abc13c42ad' AND metadata->>'is_sandbox'='true';