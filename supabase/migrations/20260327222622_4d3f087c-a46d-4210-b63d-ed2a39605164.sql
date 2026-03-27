
-- Step 1: Move 7 files from duplicate Março 2026 subfolders to the original Março 2026 folder
UPDATE files SET folder_id = '37140e82-438c-4184-a2a7-df9631db630b'
WHERE id IN (
  '2368e57d-c602-446b-83db-9d748cf23af8',
  '59c75654-f0e5-4667-9bd4-ff1c26dbae71',
  '32419b8c-978c-4733-b531-027ae2e4aa4d',
  '38f0bdad-b729-46df-a757-7f9aee9c93bc',
  '8e221c0f-37fd-489c-b40f-6b80e64673c6',
  '59a982e5-e26a-4261-9d3a-a4c920a97d45',
  '0f57ed20-c02e-4dc8-9de2-a94d3090d5d0'
);

-- Step 2: Delete duplicate month subfolders (Março and Abril inside duplicate roots)
DELETE FROM files WHERE id IN (
  'b521298e-5c28-41d1-814f-9cdb0aa3bb8e',
  'def6b23a-9b7a-4c5c-9e9a-5edbc3d70d8f',
  '46ccce66-97cc-4ee9-8b8d-cbbe6b04f1fa',
  '6ed23d8a-25a5-4575-b74f-4aa5640f5545',
  'b3b4abc6-7557-4789-acd4-06bfb36c852d',
  'aa037836-e3cb-4829-81e8-c920eed8aa14',
  'e7ae815f-c079-4579-8f9f-4f5aee564761',
  'b2b6e2ee-b92d-460f-ab3d-b2dbbcd87d21',
  '42468046-9941-4705-bc4e-b34dff21e3eb',
  '6929cea1-bb1d-4db3-a3e0-8b7eb4cb568d',
  '4b300647-91e2-4d8b-860a-5a9a131c8564',
  'd73abc53-3aa7-4ee6-be57-83b61597a7f8',
  '5e6c2272-898e-44b4-9119-2acd703c9f0f',
  '3bfecc99-faa3-4acb-ab99-a592fb8be0e1',
  '536f949c-35bc-4e37-af1f-547f84cd14c1',
  '604b8f5b-e8f2-49b8-a943-f49fcecdcf44',
  'e2cf7d7c-7b98-40f4-ad8c-fdcaf7c87a2f'
);

-- Step 3: Delete 17 duplicate "Mídias Sociais" root folders (keep only the original cf6798af)
DELETE FROM files WHERE id IN (
  'c507c25c-37eb-4a8f-aca4-56f6d6981e79',
  '4e9947c0-14c0-4408-bdcc-651b470e1dd9',
  '6451f74d-c4c1-4d0a-aa3e-447e5d10fb60',
  '6a7a3759-65f9-48e6-9380-5ab687349146',
  'a4eab8d3-8195-4de1-bb5a-16f457d6b62b',
  '72c85c3b-a905-437e-a333-390b7c7caf8e',
  '0a5a483d-007d-4d78-befc-002542287490',
  '601e0f04-da8d-40b8-b399-5d38970c99e3',
  '79e468d3-359c-40cb-890c-ec1105e27192',
  'dba0b017-411e-4c9e-bca9-aed0120acd5f',
  '41fe8bfe-4f42-4275-bf81-5a5eae5b0aad',
  '1a845666-d5a8-4f00-a4ab-765679c913ee',
  '68298feb-436f-4eb8-8090-d738ba92070f',
  '04dbae20-b164-4929-9910-d9fb56e1f195',
  '49265cd1-f48e-42ff-b0cb-2f68d88f4e7f',
  'dc797147-97c8-415c-b524-ae41c6cc0238',
  'dad8ee7e-ad83-4a08-b2af-111f312ab649'
);
