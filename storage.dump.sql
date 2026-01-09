SET session_replication_role = replica;

--
-- PostgreSQL database dump
--

-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: buckets; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

INSERT INTO "storage"."buckets" ("id", "name", "owner", "created_at", "updated_at", "public", "avif_autodetection", "file_size_limit", "allowed_mime_types", "owner_id", "type") VALUES
	('placeholder', 'placeholder', NULL, '2025-08-26 20:09:55.940466+00', '2025-08-26 20:09:55.940466+00', true, false, NULL, NULL, NULL, 'STANDARD'),
	('serp-thumbs', 'serp-thumbs', NULL, '2025-08-14 20:44:02.878904+00', '2025-08-14 20:44:02.878904+00', true, false, NULL, NULL, NULL, 'STANDARD'),
	('images', 'images', NULL, '2025-09-09 00:37:36.991691+00', '2025-09-09 00:37:36.991691+00', true, false, 10485760, '{image/*}', NULL, 'STANDARD');


--
-- Data for Name: buckets_analytics; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: buckets_vectors; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: objects; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

INSERT INTO "storage"."objects" ("id", "bucket_id", "name", "owner", "created_at", "updated_at", "last_accessed_at", "metadata", "version", "owner_id", "user_metadata", "level") VALUES
	('88eacdf4-c7c4-4d8f-b309-1c4fcff982ec', 'serp-thumbs', 'serp/11109/11109294e97647ec9b7f92e17e6b69a9e957186f1bd647d52fce31ff6f932dba.null', NULL, '2025-08-31 19:36:33.147898+00', '2025-09-02 02:09:21.449859+00', '2025-08-31 19:36:33.147898+00', '{"eTag": "\"eec37900eb84cd0fc9bca955a936e086\"", "size": 394, "mimetype": "image/null", "cacheControl": "max-age=3600", "lastModified": "2025-09-02T02:09:22.000Z", "contentLength": 394, "httpStatusCode": 200}', 'd6c7055b-d917-4786-96a7-b58447029259', NULL, '{}', 3),
	('2bd5a8a5-b2a4-4d24-b85a-7dd43c1d7ddc', 'serp-thumbs', 'serp/77dfc/77dfcbc810c9a71f218a037ace92eec4ab1ac137ace52c813fa43b955323090e.jpg', NULL, '2025-08-27 08:35:09.196261+00', '2025-09-01 04:12:48.944701+00', '2025-08-27 08:35:09.196261+00', '{"eTag": "\"d0b942169748f6bbb1c28da717fbc53a\"", "size": 514710, "mimetype": "image/jpg", "cacheControl": "max-age=3600", "lastModified": "2025-09-01T04:12:49.000Z", "contentLength": 514710, "httpStatusCode": 200}', 'bc4eef53-f7d0-4591-b467-404f0ac316a3', NULL, '{}', 3),
	('2525aaf0-2824-4d2e-968e-a6e1144986f1', 'serp-thumbs', 'serp/463ec/463ec07c9d90d03b8f3e0053b6dfcccde67fa40fff85c736db617a3304440c2c.jpg', NULL, '2025-08-27 08:35:08.993147+00', '2025-09-01 04:12:49.049891+00', '2025-08-27 08:35:08.993147+00', '{"eTag": "\"4b48c673519aa8518df79857cccbe640\"", "size": 282277, "mimetype": "image/jpg", "cacheControl": "max-age=3600", "lastModified": "2025-09-01T04:12:49.000Z", "contentLength": 282277, "httpStatusCode": 200}', '43101ecd-0ac6-499b-a410-06df75951056', NULL, '{}', 3),
	('3c0688ce-1551-46f3-9371-0c686304494b', 'serp-thumbs', 'serp/77374/7737463663d903da8789398bf8cad6950837d0021738e9daab6898169f890a98.jpg', NULL, '2025-08-27 08:35:08.700528+00', '2025-09-02 02:09:22.566084+00', '2025-08-27 08:35:08.700528+00', '{"eTag": "\"0900e52f4abdee05ca86e57617e0ee0a\"", "size": 43030, "mimetype": "image/jpg", "cacheControl": "max-age=3600", "lastModified": "2025-09-02T02:09:23.000Z", "contentLength": 43030, "httpStatusCode": 200}', '5ff1df41-04eb-40da-90e4-e8a59d0e7b2c', NULL, '{}', 3),
	('3189063a-e0a3-4101-a9f7-596cc89a841b', 'serp-thumbs', 'serp/8ae5d/8ae5db4d967819ffcce16c825498febe9e98c4dee37e853211383ebd2bd615d5.bin', NULL, '2025-08-27 21:28:47.313738+00', '2025-08-27 21:50:56.035621+00', '2025-08-27 21:28:47.313738+00', '{"eTag": "\"d288a9a7011b78a4b37e23ecd791b5e7\"", "size": 394, "mimetype": "image/bin", "cacheControl": "max-age=3600", "lastModified": "2025-08-27T21:50:56.000Z", "contentLength": 394, "httpStatusCode": 200}', '22621af9-c4f4-4b08-ac87-1c3104118d91', NULL, '{}', 3),
	('b877bd08-c7b5-4b9a-a632-6d2fea8f188b', 'serp-thumbs', 'serp/f6ad3/f6ad3d20918980be84376fe54667ccdd16aa960b00e956156a9b28cfffbb6501.bin', NULL, '2025-08-27 08:35:11.556543+00', '2025-08-27 18:16:25.851877+00', '2025-08-27 08:35:11.556543+00', '{"eTag": "\"1696d30f0e218b84a69167866f284735\"", "size": 394, "mimetype": "image/bin", "cacheControl": "max-age=3600", "lastModified": "2025-08-27T18:16:26.000Z", "contentLength": 394, "httpStatusCode": 200}', '650f63f2-2569-4bcb-ad8f-c34a78ef54ff', NULL, '{}', 3),
	('008e23e8-04b0-4e46-97e3-ec6480f7569d', 'images', 'original/b3/b3b8d74d39644784a43fb50e88ea6f0b38f8b885405c51b9fe88e301e7fe86dc.jpg', NULL, '2025-09-09 22:54:52.956088+00', '2025-09-11 22:51:55.325852+00', '2025-09-09 22:54:52.956088+00', '{"eTag": "\"33a445c560bf244922cc7998de4d3d0d\"", "size": 119285, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2025-09-11T22:51:56.000Z", "contentLength": 119285, "httpStatusCode": 200}', '7c62c42e-29fb-4422-8d26-344330dc9325', NULL, '{}', 3),
	('4eef0905-cab1-4b15-8601-d4ed8924d410', 'images', 'original/87/87dbeb961242df65711108727b1bc569294b341bc0172979be946de9896af4a2.jpg', NULL, '2025-09-09 00:45:37.854232+00', '2025-09-09 18:55:51.168821+00', '2025-09-09 00:45:37.854232+00', '{"eTag": "\"68459ec9b34d27a515f04f4e125bd3a0\"", "size": 230315, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2025-09-09T18:55:52.000Z", "contentLength": 230315, "httpStatusCode": 200}', 'ed510c91-bc10-42c2-9880-9ddbe3c08fd4', NULL, '{}', 3),
	('0c74fb61-3be1-4570-be1b-4fe7e6a48d32', 'serp-thumbs', 'serp/a2e54/a2e54af426ad2016026cd19d5ca0bf5cbc55dcaa016809327e4f0892156219cf.jpg', NULL, '2025-08-27 08:35:10.302406+00', '2025-08-27 09:34:48.058737+00', '2025-08-27 08:35:10.302406+00', '{"eTag": "\"2ea26c5cbad22b16da17483095a1ca88\"", "size": 285142, "mimetype": "image/jpg", "cacheControl": "max-age=3600", "lastModified": "2025-08-27T09:34:48.000Z", "contentLength": 285142, "httpStatusCode": 200}', 'ffcd9e96-87ef-445b-bb40-7858e9dc728a', NULL, '{}', 3),
	('b5f5c744-4194-4867-917d-78cc8e5e1c51', 'serp-thumbs', 'serp/a851d/a851d9114a87bc258daf675bed272e450f65367e7f5082ed892ab1ea87f5cafd.jpg', NULL, '2025-08-27 08:35:10.232478+00', '2025-08-29 06:40:43.123017+00', '2025-08-27 08:35:10.232478+00', '{"eTag": "\"445d664e5133bee9016e6f7508605f1b\"", "size": 485720, "mimetype": "image/jpg", "cacheControl": "max-age=3600", "lastModified": "2025-08-29T06:40:44.000Z", "contentLength": 485720, "httpStatusCode": 200}', '2ef60c5b-a88d-46a3-bfcc-a92703a9aac3', NULL, '{}', 3),
	('244b4ac8-4ce9-4cfa-ba55-550e6d06830c', 'serp-thumbs', 'serp/e3637/e36370dbc7f68024c7b62124cb89d71fd5033e5acb519f5625c8a22d25f0b527.jpg', NULL, '2025-08-27 08:35:09.352828+00', '2025-08-27 09:34:47.855714+00', '2025-08-27 08:35:09.352828+00', '{"eTag": "\"e7a2a9430a4d7150e1a374ca32368f51\"", "size": 148720, "mimetype": "image/jpg", "cacheControl": "max-age=3600", "lastModified": "2025-08-27T09:34:48.000Z", "contentLength": 148720, "httpStatusCode": 200}', 'f63dc2a4-949b-4216-a50e-0cee7a47201d', NULL, '{}', 3),
	('6c39fccf-1b25-4df1-81f8-46d1fb6c4b54', 'serp-thumbs', 'serp/c6134/c6134501eb0fd05b6986e33cb456fa2ecfcb8b53e026c23040ea938dd502ce05.jpg', NULL, '2025-08-27 08:35:11.205844+00', '2025-08-27 18:16:28.675325+00', '2025-08-27 08:35:11.205844+00', '{"eTag": "\"dddd82a56488bde0e355c67d40b2ef2d\"", "size": 447021, "mimetype": "image/jpg", "cacheControl": "max-age=3600", "lastModified": "2025-08-27T18:16:29.000Z", "contentLength": 447021, "httpStatusCode": 200}', '7ca81109-1a6c-40d2-baf3-c1acf2aca304', NULL, '{}', 3),
	('42c724d7-3e60-46b7-be8a-3730904edea7', 'images', 'original/95/957e5d5247dea3dec563a0f94793a5e0ecee8ec3d53fb73fd25d81d28d3626cf.jpg', NULL, '2025-09-11 19:16:09.654734+00', '2025-09-11 22:44:01.396599+00', '2025-09-11 19:16:09.654734+00', '{"eTag": "\"64005d782c965e8c093731449958bc53\"", "size": 69816, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2025-09-11T22:44:02.000Z", "contentLength": 69816, "httpStatusCode": 200}', '1cbc0a40-4674-4eb5-aa7c-91efb1f76cff', NULL, '{}', 3),
	('ae93e9ab-2fe0-44ed-b559-9795a0034a6c', 'serp-thumbs', 'serp/8ae5d/8ae5db4d967819ffcce16c825498febe9e98c4dee37e853211383ebd2bd615d5.null', NULL, '2025-08-27 22:20:05.765008+00', '2025-09-01 04:12:48.814621+00', '2025-08-27 22:20:05.765008+00', '{"eTag": "\"4998779e98cc5d79e928f507b0b22285\"", "size": 394, "mimetype": "image/null", "cacheControl": "max-age=3600", "lastModified": "2025-09-01T04:12:49.000Z", "contentLength": 394, "httpStatusCode": 200}', '748e70f1-ff1c-4f33-83e4-d43de46c2e8f', NULL, '{}', 3),
	('aa623cea-ca4d-4db0-b5dc-f8cb6a99913e', 'serp-thumbs', 'serp/9636a/9636ab829ee368cad41438f6eafa8708bd28ca617f86f56cf18fe5b6ee8464c0.null', NULL, '2025-08-28 19:29:14.112205+00', '2025-09-02 04:12:27.410637+00', '2025-08-28 19:29:14.112205+00', '{"eTag": "\"ec144c1130d50a515a4d1759e8d797ef\"", "size": 392, "mimetype": "image/null", "cacheControl": "max-age=3600", "lastModified": "2025-09-02T04:12:28.000Z", "contentLength": 392, "httpStatusCode": 200}', '40320b54-ae2d-4e7f-9943-4c68055d12c5', NULL, '{}', 3),
	('813f8958-723b-4bc2-b4c3-2c8e5ba553b2', 'images', 'original/82/82c3ab444ce2494b8b6436254933f0677be8da93f77047c5e4ad8c58010654d9.jpg', NULL, '2025-09-09 22:54:53.071499+00', '2025-09-11 22:51:54.808488+00', '2025-09-09 22:54:53.071499+00', '{"eTag": "\"3a466ccdc68a23b637bb5e9c08110d00\"", "size": 94890, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2025-09-11T22:51:55.000Z", "contentLength": 94890, "httpStatusCode": 200}', '2d9c20de-02b3-4cf8-b47c-051b75741dd1', NULL, '{}', 3),
	('ba1908e9-7396-4948-85e7-7bb5bdb6e363', 'images', 'original/cc/cc2275995428765d571f7b0226811cf30b9ad13b178f39025773df1b99466824.jpg', NULL, '2025-09-09 22:54:53.129047+00', '2025-09-11 22:51:55.063388+00', '2025-09-09 22:54:53.129047+00', '{"eTag": "\"3abfa13fb117f3ad06528bf36d5608c4\"", "size": 399405, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2025-09-11T22:51:55.000Z", "contentLength": 399405, "httpStatusCode": 200}', 'bd7f6f83-6322-4515-8114-67d29933a781', NULL, '{}', 3),
	('dc52b66a-1905-47ba-a141-44d53c36b749', 'images', 'original/b9/b9d60589244b8c99db5c02b3fff860940b276bd56abedbae011d88dcbda27fe6.jpg', NULL, '2025-09-09 22:54:52.323689+00', '2025-09-11 22:43:30.6489+00', '2025-09-09 22:54:52.323689+00', '{"eTag": "\"8fea7d3ddf35e72973613df760e67b8d\"", "size": 45116, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2025-09-11T22:43:31.000Z", "contentLength": 45116, "httpStatusCode": 200}', '40ba45fe-9679-4eef-8a2e-da76a062bb17', NULL, '{}', 3),
	('40f07029-2a3b-4842-a38c-ee94ad842b60', 'placeholder', 'default.png', NULL, '2025-08-27 03:39:19.383327+00', '2025-08-27 03:39:32.595457+00', '2025-08-27 03:39:19.383327+00', '{"eTag": "\"cab9be5908b086a189eabc058cb39a3a\"", "size": 8254, "mimetype": "image/png", "cacheControl": "max-age=3600", "lastModified": "2025-08-27T03:39:33.000Z", "contentLength": 8254, "httpStatusCode": 200}', '3988113d-1d66-4bd0-ac03-6dcc3f5f3f97', NULL, NULL, 1),
	('fea036a5-4081-4edb-82a6-7c657112f92f', 'images', 'original/9a/9ac3783a3b6d6f47c35284547b17b20c541f98366f2cf39fabd436213c45b4cf.jpg', NULL, '2025-09-09 22:54:52.286808+00', '2025-09-11 22:43:30.696876+00', '2025-09-09 22:54:52.286808+00', '{"eTag": "\"76dc820452636457af9563d0c6b519d1\"", "size": 92121, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2025-09-11T22:43:31.000Z", "contentLength": 92121, "httpStatusCode": 200}', 'c08a8328-0ec8-4b74-b5fa-c1a967b359ec', NULL, '{}', 3),
	('aa11c269-9410-4eb3-a3bd-6a1fb97a54c5', 'serp-thumbs', 'serp/87b39/87b3936a0c06ea0864a2d31bd37af19c50d369724bb5108f9e434552a282c361.jpg', NULL, '2025-08-28 19:29:14.957736+00', '2025-08-29 06:40:42.625805+00', '2025-08-28 19:29:14.957736+00', '{"eTag": "\"1aed2f7528f49a7cf9870d4a31b4d72a\"", "size": 17699, "mimetype": "image/jpg", "cacheControl": "max-age=3600", "lastModified": "2025-08-29T06:40:43.000Z", "contentLength": 17699, "httpStatusCode": 200}', '81008ccc-4854-4e2b-b466-b73ed596ac56', NULL, '{}', 3),
	('ec7c03f5-8770-49fc-8895-3df8435e3e2e', 'serp-thumbs', 'serp/707e5/707e5c292fed241b1ff7263b13d73ec30e2a8c9718a71090a859f4f250c27dc2.jpg', NULL, '2025-09-01 02:18:29.165133+00', '2025-09-02 04:04:09.450938+00', '2025-09-01 02:18:29.165133+00', '{"eTag": "\"1007adbdecdc814e4c42fa16ad896bcb\"", "size": 272885, "mimetype": "image/jpg", "cacheControl": "max-age=3600", "lastModified": "2025-09-02T04:04:10.000Z", "contentLength": 272885, "httpStatusCode": 200}', '58598198-cff1-4e85-b2be-0765df668972', NULL, '{}', 3),
	('16dc6567-eb1f-4767-bd20-b895afe1ca3b', 'serp-thumbs', 'serp/39e43/39e4340409b6f1f6934b33bd6c4536554af9efa7ee509547448fd437a2ac0a9a.null', NULL, '2025-09-01 02:18:28.904897+00', '2025-09-02 04:04:10.450132+00', '2025-09-01 02:18:28.904897+00', '{"eTag": "\"2ad067fc57ba359bd0794087f4cc913e\"", "size": 394, "mimetype": "image/null", "cacheControl": "max-age=3600", "lastModified": "2025-09-02T04:04:11.000Z", "contentLength": 394, "httpStatusCode": 200}', '07fb8326-cc2e-49df-bccc-0ca144da5da8', NULL, '{}', 3),
	('3496bf99-f088-4863-9543-24d8b664011a', 'images', 'original/ce/ce5d478247bcbc66293d1d3a67ec7a9a4cd6539b012c3fe12d18b82b55cbaffc.jpg', NULL, '2025-09-09 22:54:53.176993+00', '2025-09-11 22:51:55.486988+00', '2025-09-09 22:54:53.176993+00', '{"eTag": "\"adeccbdec18d26eee897ecdac2ce8f90\"", "size": 40692, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2025-09-11T22:51:56.000Z", "contentLength": 40692, "httpStatusCode": 200}', '822a6541-b09b-4bd9-85ae-93bc6f715181', NULL, '{}', 3),
	('7778a27b-2e37-4141-97d8-fc70846c5e43', 'images', 'original/b4/b4e40d8cc9d10a2c2207cefd49452851dcdbf8d14908961542486ab209fd9f69.jpg', NULL, '2025-09-09 22:54:52.424174+00', '2025-09-11 22:43:30.784264+00', '2025-09-09 22:54:52.424174+00', '{"eTag": "\"66d64891bc56fb408b50e8c4769b2f0b\"", "size": 195724, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2025-09-11T22:43:31.000Z", "contentLength": 195724, "httpStatusCode": 200}', 'ed3747f6-8c95-46a3-bd11-0de76e56b6e2', NULL, '{}', 3),
	('abea1088-d667-497f-99d6-b465db55b9f8', 'serp-thumbs', 'serp/ad32d/ad32da95bfee35707f8f2e041ad356c428ebe4078d6fdeef0279faa9d9db4c92.jpg', NULL, '2025-08-27 18:16:25.271597+00', '2025-09-02 04:04:09.281096+00', '2025-08-27 18:16:25.271597+00', '{"eTag": "\"df04905aafb2460acc3d2c4a05970e4a\"", "size": 67330, "mimetype": "image/jpg", "cacheControl": "max-age=3600", "lastModified": "2025-09-02T04:04:10.000Z", "contentLength": 67330, "httpStatusCode": 200}', '13817ddd-21da-41a8-a7d1-23ac89bb7086', NULL, '{}', 3),
	('fe74d6ba-45e6-4b44-be7a-ab5a2568db83', 'serp-thumbs', 'serp/011c2/011c20945ad2582807f54506bdeec614191de206941f8c5305366c947e4cfe28.jpg', NULL, '2025-08-27 18:16:25.612377+00', '2025-09-02 04:04:09.461198+00', '2025-08-27 18:16:25.612377+00', '{"eTag": "\"2fd31fbf4252dc6d5700d68f47da860c\"", "size": 10810, "mimetype": "image/jpg", "cacheControl": "max-age=3600", "lastModified": "2025-09-02T04:04:10.000Z", "contentLength": 10810, "httpStatusCode": 200}', 'ceac3eb1-fa05-4892-a256-1d7210871a08', NULL, '{}', 3),
	('66c854f9-5493-4b05-9a38-5b6e52c13f3f', 'serp-thumbs', 'serp/f6ad3/f6ad3d20918980be84376fe54667ccdd16aa960b00e956156a9b28cfffbb6501.null', NULL, '2025-08-27 23:43:05.532948+00', '2025-08-28 00:12:04.498868+00', '2025-08-27 23:43:05.532948+00', '{"eTag": "\"ae6e0b11f3c690cd3a1b241c95bee14b\"", "size": 394, "mimetype": "image/null", "cacheControl": "max-age=3600", "lastModified": "2025-08-28T00:12:05.000Z", "contentLength": 394, "httpStatusCode": 200}', '418451fb-af82-4952-8f57-30be314ee080', NULL, '{}', 3),
	('d32f4a92-13ee-4f23-9a18-dc82b419ed68', 'images', 'original/2b/2b30465c79c3f83bf280f8e37d2d664ec25629a816c3c6dbffdfbc63a4d635ef.jpg', NULL, '2025-09-11 19:16:10.27762+00', '2025-09-11 22:44:01.552639+00', '2025-09-11 19:16:10.27762+00', '{"eTag": "\"5ebca0f9d8a5ff30701befc296fc7d87\"", "size": 200305, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2025-09-11T22:44:02.000Z", "contentLength": 200305, "httpStatusCode": 200}', '94919fea-cf41-4059-8fd4-5544710cc000', NULL, '{}', 3),
	('e068da82-15e8-45c6-a84f-d9a93bb7b769', 'serp-thumbs', 'serp/9b71d/9b71dc9f5510c247eedfddddbcdfac252ca83d97540ce17f502bc1f92c91f6a6.jpg', NULL, '2025-08-27 18:16:26.182572+00', '2025-09-02 04:06:20.274461+00', '2025-08-27 18:16:26.182572+00', '{"eTag": "\"25372e040f7881ba50c9a955aad20a07\"", "size": 386376, "mimetype": "image/jpg", "cacheControl": "max-age=3600", "lastModified": "2025-09-02T04:06:21.000Z", "contentLength": 386376, "httpStatusCode": 200}', '3e2d05e1-2ce9-47d4-8833-78719cd8dd87', NULL, '{}', 3),
	('37441ad8-41c1-4a98-9a10-c6026a4fe0c2', 'images', 'original/67/675ec70c2108acf09e30695e6e1d5bb78ca458bc984d7a1ac94508190fb4b6a1.webp', NULL, '2025-09-09 22:54:52.797189+00', '2025-09-11 22:51:55.167268+00', '2025-09-09 22:54:52.797189+00', '{"eTag": "\"302530bf9d8e723194d57e037ab45266\"", "size": 93930, "mimetype": "image/webp", "cacheControl": "max-age=3600", "lastModified": "2025-09-11T22:51:56.000Z", "contentLength": 93930, "httpStatusCode": 200}', '07759ad5-3691-4e82-928f-2aa741e42b0b', NULL, '{}', 3),
	('68897b64-8f42-4a91-8aac-090d1c48f15e', 'images', 'original/f8/f899e3fd70ed7d4cd8a5cc236a29af430d8c087a4bd5914fe65a0814b16d30fe.jpg', NULL, '2025-09-09 00:37:39.863844+00', '2025-09-09 18:55:51.963896+00', '2025-09-09 00:37:39.863844+00', '{"eTag": "\"df04905aafb2460acc3d2c4a05970e4a\"", "size": 67330, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2025-09-09T18:55:52.000Z", "contentLength": 67330, "httpStatusCode": 200}', '2b3f2a26-3293-4195-904e-5457a2dd97ad', NULL, '{}', 3),
	('f92b3f32-3366-47a4-820a-516feb404ffe', 'images', 'original/b0/b0b47a3fac0b2f0dfd48d0181f5bf2445ac11b16781d31c375125cd7e24f8df9.jpg', NULL, '2025-09-09 00:37:38.160683+00', '2025-09-09 18:55:51.729613+00', '2025-09-09 00:37:38.160683+00', '{"eTag": "\"1007adbdecdc814e4c42fa16ad896bcb\"", "size": 272885, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2025-09-09T18:55:52.000Z", "contentLength": 272885, "httpStatusCode": 200}', '669675a8-e330-4720-bc68-7f6602f38870', NULL, '{}', 3),
	('b2d4af47-7dd2-4142-8092-3855e9729a1d', 'images', 'original/22/221ba42ea42486438cf4c69fea4c56ba8c123ccc74ea820f1aea12948bd02043.jpg', NULL, '2025-09-09 00:37:39.056679+00', '2025-09-09 18:55:51.232801+00', '2025-09-09 00:37:39.056679+00', '{"eTag": "\"25372e040f7881ba50c9a955aad20a07\"", "size": 386376, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2025-09-09T18:55:52.000Z", "contentLength": 386376, "httpStatusCode": 200}', '1d87a1d5-1f1c-4026-adb2-8fe31eef392c', NULL, '{}', 3),
	('3a520814-6587-4850-9954-f9635d5d1ae4', 'images', 'original/f6/f6a7f63f8b34ddbeffab4022185ba7b42bca2589699b0f9f8e69fa61e1580001.jpg', NULL, '2025-09-09 00:37:38.266024+00', '2025-09-09 18:55:51.251187+00', '2025-09-09 00:37:38.266024+00', '{"eTag": "\"ba9aeba8cc04be72633d0fd2b28888a0\"", "size": 471648, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2025-09-09T18:55:52.000Z", "contentLength": 471648, "httpStatusCode": 200}', 'f2def37e-fe7a-45a4-8b15-f76ca47b736a', NULL, '{}', 3),
	('126ec64c-6ab7-460f-a864-20ced6bbc5eb', 'images', 'original/1d/1d85f93793791a635f8cd5219f6145c3f677745ebc8c64762080b85c884f7241.jpg', NULL, '2025-09-09 00:37:38.701424+00', '2025-09-09 18:41:05.648856+00', '2025-09-09 00:37:38.701424+00', '{"eTag": "\"60fe10315965267827590ec0cc05f5a5\"", "size": 234868, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2025-09-09T18:41:06.000Z", "contentLength": 234868, "httpStatusCode": 200}', 'b0971c1c-dbc2-49d2-b7c3-5f27ebe85ddc', NULL, '{}', 3),
	('c0fa7b06-2824-41c4-9963-099bded5970c', 'images', 'original/e4/e42ed2e12b3bbe48961e30d7d7c2e63c1ff26853d08728d553af3a7fa4a8dd96.jpg', NULL, '2025-09-09 00:37:37.479469+00', '2025-09-09 18:55:52.344885+00', '2025-09-09 00:37:37.479469+00', '{"eTag": "\"2fd31fbf4252dc6d5700d68f47da860c\"", "size": 10810, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2025-09-09T18:55:53.000Z", "contentLength": 10810, "httpStatusCode": 200}', 'e50c333e-1c24-4849-8afa-3d371379f3ee', NULL, '{}', 3),
	('27f55386-0a4f-4243-b9cd-1a942e2c20fb', 'images', 'original/92/926a84ef6189834f67ea0c16c71ac5d67c0b9d75ff9c5ac85ed1716b5ee95c18.jpg', NULL, '2025-09-09 22:54:53.393049+00', '2025-09-11 22:51:54.752873+00', '2025-09-09 22:54:53.393049+00', '{"eTag": "\"f860b7172e1011d4c06391494b0cf376\"", "size": 49488, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2025-09-11T22:51:55.000Z", "contentLength": 49488, "httpStatusCode": 200}', 'a6bb0584-d879-4c5c-87b4-61c0065b5766', NULL, '{}', 3),
	('0a778996-55ea-46fa-adec-4989ce40518a', 'images', 'original/ae/ae91eca03233e9d01c303f2bca5e85c953bd4cb9d21c889c2b2e947c889980f0.jpg', NULL, '2025-09-09 22:54:53.200959+00', '2025-09-11 22:51:55.547404+00', '2025-09-09 22:54:53.200959+00', '{"eTag": "\"a873e271a85894be30e5cc683abb68d3\"", "size": 85855, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2025-09-11T22:51:56.000Z", "contentLength": 85855, "httpStatusCode": 200}', '1cc330f1-365e-418d-92ec-ac0e5588aa3c', NULL, '{}', 3),
	('81742760-03d5-4776-a5b1-5a29f2051ee5', 'images', 'original/17/17d60a68400b2366aff1d828628e8f5f35e3e50dec3f38f8f3c794fc85604e88.jpg', NULL, '2025-09-09 22:54:53.448259+00', '2025-09-11 22:51:55.616613+00', '2025-09-09 22:54:53.448259+00', '{"eTag": "\"08d3bc1fda8e038bb6167274596f0215\"", "size": 19861, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2025-09-11T22:51:56.000Z", "contentLength": 19861, "httpStatusCode": 200}', '4f27214a-a01d-4944-9a9e-79c6d5b5db10', NULL, '{}', 3),
	('850e6b5e-3309-4d90-97e3-efea77556214', 'images', 'original/e1/e110ef3051929c7e1bb93e29d230c14697a9de3e20a88ff0138320b0dd6ab8c3.jpg', NULL, '2025-09-09 22:54:53.324855+00', '2025-09-11 22:51:54.59055+00', '2025-09-09 22:54:53.324855+00', '{"eTag": "\"fa8ae56fc1dc4f55a2def92449b2f1b5\"", "size": 15190, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2025-09-11T22:51:55.000Z", "contentLength": 15190, "httpStatusCode": 200}', 'ab521ae2-9ade-4c50-9487-8bba0398b1c6', NULL, '{}', 3),
	('9a0c2778-7c68-40bc-be4f-e12ff932c55c', 'images', 'original/95/959a74563cbce6e108720c60bf4ff5df3608c390de53dff548c0cdea7bcf1596.jpg', NULL, '2025-09-09 22:54:55.236516+00', '2025-09-11 22:51:57.159781+00', '2025-09-09 22:54:55.236516+00', '{"eTag": "\"03df062144a1be6cbfabbfa36b50cb2a\"", "size": 35925, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2025-09-11T22:51:58.000Z", "contentLength": 35925, "httpStatusCode": 200}', '45f99c0a-7daf-45d5-907a-3b95288c4cb0', NULL, '{}', 3),
	('ab976736-bc7a-47b3-93a3-4891ff11dce3', 'images', 'original/dd/ddd18824f04688d676686055cdb4503fe8647a5d24caacfc99bd85d41471f3cb.jpg', NULL, '2025-09-09 22:54:54.87975+00', '2025-09-11 22:51:56.082529+00', '2025-09-09 22:54:54.87975+00', '{"eTag": "\"df76828e63c92e893f323ab6675063a2\"", "size": 149707, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2025-09-11T22:51:57.000Z", "contentLength": 149707, "httpStatusCode": 200}', 'f00b7a67-9f1b-4c82-8d87-34ffb83c2c3b', NULL, '{}', 3),
	('2654bd45-ca77-4e2a-8bb6-3790e22a9bfd', 'images', 'original/b6/b648854ef9290df23ca4d704c7b010462e7f2312f73c50427759e0614550a9c8.jpg', NULL, '2025-09-09 22:55:03.391521+00', '2025-09-11 22:52:06.74494+00', '2025-09-09 22:55:03.391521+00', '{"eTag": "\"f763b51bc5fb8c52bc7368d2aab8b536\"", "size": 29204, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2025-09-11T22:52:07.000Z", "contentLength": 29204, "httpStatusCode": 200}', '0204a0b2-7500-4fb7-a4a8-718aebf2c986', NULL, '{}', 3),
	('5290835a-c161-497f-9d41-9c81b7df5ba7', 'images', 'original/1f/1fcfbf6f653c21e898afa4567e870b27348cf3dc13e5c8930761ef88eadc2af3.jpg', NULL, '2025-09-09 22:54:55.090595+00', '2025-09-11 22:51:57.219698+00', '2025-09-09 22:54:55.090595+00', '{"eTag": "\"70c48e9aec65877ba67a1d5a11af188d\"", "size": 11525, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2025-09-11T22:51:58.000Z", "contentLength": 11525, "httpStatusCode": 200}', '37e1e4bc-bfb8-4008-b909-b76ab53f7dc1', NULL, '{}', 3),
	('c79fcdb1-ab6f-47a7-b223-8240b2793a13', 'images', 'original/d6/d67036c07377bd49ef433c691542946d0b4ec270d09edfd755eb73e2a995502a.jpg', NULL, '2025-09-09 22:55:00.083174+00', '2025-09-11 22:52:22.310713+00', '2025-09-09 22:55:00.083174+00', '{"eTag": "\"b8665e4d8c925fdef94ff3d9e4538933\"", "size": 47627, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2025-09-11T22:52:23.000Z", "contentLength": 47627, "httpStatusCode": 200}', 'aeccc22e-cc33-49cb-993c-1736d5bd60f6', NULL, '{}', 3),
	('46a05084-8aad-48bd-b83b-e8def4228730', 'images', 'original/15/15e38ca954d3e1b25e84bdeb43f9bc325601d3f92397e798244767482093f277.jpg', NULL, '2025-09-09 22:54:54.940618+00', '2025-09-11 22:51:56.797608+00', '2025-09-09 22:54:54.940618+00', '{"eTag": "\"f6898ed02486d385b5c0f33f4801c7af\"", "size": 40392, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2025-09-11T22:51:57.000Z", "contentLength": 40392, "httpStatusCode": 200}', '158cfb84-6b13-419d-9922-5a7755d86580', NULL, '{}', 3),
	('cf439bf5-6f90-40d2-b276-e554c69bd307', 'images', 'original/0b/0b9c666646cdefe3085a0fad9dd20950199e9118b134aad13904f926eace2677.jpg', NULL, '2025-09-09 22:54:54.945685+00', '2025-09-11 22:51:56.336664+00', '2025-09-09 22:54:54.945685+00', '{"eTag": "\"5b9495dfcddae6e810f9c6b6d2c17931\"", "size": 199041, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2025-09-11T22:51:57.000Z", "contentLength": 199041, "httpStatusCode": 200}', '21b5cd06-0569-48b1-a4a7-5237309b1e32', NULL, '{}', 3),
	('f81c59ae-0020-467b-9e00-13418eb5340c', 'images', 'original/a9/a9abccf1957891c5f5754a9332281dd660d2161913469a220889b9ea9d78aea6.jpg', NULL, '2025-09-09 22:54:53.459814+00', '2025-09-11 22:51:55.618917+00', '2025-09-09 22:54:53.459814+00', '{"eTag": "\"560794d1b962cdc79ece3a3df3498d94\"", "size": 14017, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2025-09-11T22:51:56.000Z", "contentLength": 14017, "httpStatusCode": 200}', 'b5551b34-72d1-44bf-8a43-0f679c6a51d3', NULL, '{}', 3),
	('e7db33a8-d1c6-407d-beca-1eb9ca2ba0c9', 'images', 'original/25/2550dd9f499a305ca48b8a686f29ffbe6afd0e8efd9e8ed843c5331eb7177729.webp', NULL, '2025-09-09 22:54:53.394953+00', '2025-09-11 22:51:55.858082+00', '2025-09-09 22:54:53.394953+00', '{"eTag": "\"3999751554e00e64e10cacdee4e89bf2\"", "size": 70498, "mimetype": "image/webp", "cacheControl": "max-age=3600", "lastModified": "2025-09-11T22:51:56.000Z", "contentLength": 70498, "httpStatusCode": 200}', '4d34d4ef-590c-4a2f-a0bf-6f1ab24c3148', NULL, '{}', 3),
	('1ca011f1-e561-4490-9f4f-8942b912b77a', 'images', 'original/98/9871e55bf46403f4923de71e679e404df0d5163b888bb18ab716aed51b58d519.jpg', NULL, '2025-09-09 22:54:54.966424+00', '2025-09-11 22:51:57.088004+00', '2025-09-09 22:54:54.966424+00', '{"eTag": "\"93af02ed382a488951014eb3bcde0d61\"", "size": 9226, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2025-09-11T22:51:58.000Z", "contentLength": 9226, "httpStatusCode": 200}', 'c07242c8-b209-4b41-adb9-fa2a214c8b3c', NULL, '{}', 3),
	('fd492ad7-5b22-415a-bf00-7d1cd68d6c1d', 'images', 'original/b3/b36c182ae95da5a332fe530bf6cc45872c8554df807f94b18edfbd6bbefa3c2b.jpg', NULL, '2025-09-09 22:54:53.627146+00', '2025-09-11 22:52:13.495689+00', '2025-09-09 22:54:53.627146+00', '{"eTag": "\"73e922d1cdec331e5fcffd29296bad73\"", "size": 216332, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2025-09-11T22:52:14.000Z", "contentLength": 216332, "httpStatusCode": 200}', 'cc052410-5ae4-4a2d-a390-e1f863d84190', NULL, '{}', 3),
	('f99a3421-fcf5-455b-9b4c-9dbb563865d9', 'images', 'original/cd/cde15f6b2c498acdbcd0b7c02e38966dce3bfbb94d69d456afea49d8920f6ad7.jpg', NULL, '2025-09-09 22:54:55.032645+00', '2025-09-11 22:51:56.325381+00', '2025-09-09 22:54:55.032645+00', '{"eTag": "\"761741082af231fd1f6b4e020d5558c1\"", "size": 273137, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2025-09-11T22:51:57.000Z", "contentLength": 273137, "httpStatusCode": 200}', 'ae90de8b-c064-4628-b0a6-c2556e2f5b89', NULL, '{}', 3);


--
-- Data for Name: prefixes; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

INSERT INTO "storage"."prefixes" ("bucket_id", "name", "created_at", "updated_at") VALUES
	('serp-thumbs', 'serp/ad32d', '2025-08-27 18:16:25.271597+00', '2025-08-27 18:16:25.271597+00'),
	('serp-thumbs', 'serp/011c2', '2025-08-27 18:16:25.612377+00', '2025-08-27 18:16:25.612377+00'),
	('serp-thumbs', 'serp/9b71d', '2025-08-27 18:16:26.182572+00', '2025-08-27 18:16:26.182572+00'),
	('serp-thumbs', 'serp/8ae5d', '2025-08-27 21:28:47.313738+00', '2025-08-27 21:28:47.313738+00'),
	('serp-thumbs', 'serp/9636a', '2025-08-28 19:29:14.112205+00', '2025-08-28 19:29:14.112205+00'),
	('serp-thumbs', 'serp/87b39', '2025-08-28 19:29:14.957736+00', '2025-08-28 19:29:14.957736+00'),
	('serp-thumbs', 'serp/11109', '2025-08-31 19:36:33.147898+00', '2025-08-31 19:36:33.147898+00'),
	('serp-thumbs', 'serp/39e43', '2025-09-01 02:18:28.904897+00', '2025-09-01 02:18:28.904897+00'),
	('serp-thumbs', 'serp/707e5', '2025-09-01 02:18:29.165133+00', '2025-09-01 02:18:29.165133+00'),
	('images', 'original', '2025-09-09 00:37:37.479469+00', '2025-09-09 00:37:37.479469+00'),
	('images', 'original/e4', '2025-09-09 00:37:37.479469+00', '2025-09-09 00:37:37.479469+00'),
	('images', 'original/b0', '2025-09-09 00:37:38.160683+00', '2025-09-09 00:37:38.160683+00'),
	('images', 'original/f6', '2025-09-09 00:37:38.266024+00', '2025-09-09 00:37:38.266024+00'),
	('images', 'original/1d', '2025-09-09 00:37:38.701424+00', '2025-09-09 00:37:38.701424+00'),
	('images', 'original/22', '2025-09-09 00:37:39.056679+00', '2025-09-09 00:37:39.056679+00'),
	('images', 'original/f8', '2025-09-09 00:37:39.863844+00', '2025-09-09 00:37:39.863844+00'),
	('images', 'original/87', '2025-09-09 00:45:37.854232+00', '2025-09-09 00:45:37.854232+00'),
	('images', 'original/9a', '2025-09-09 22:54:52.286808+00', '2025-09-09 22:54:52.286808+00'),
	('images', 'original/b9', '2025-09-09 22:54:52.323689+00', '2025-09-09 22:54:52.323689+00'),
	('serp-thumbs', 'serp', '2025-08-27 06:56:39.44075+00', '2025-08-27 06:56:39.44075+00'),
	('images', 'original/b4', '2025-09-09 22:54:52.424174+00', '2025-09-09 22:54:52.424174+00'),
	('images', 'original/67', '2025-09-09 22:54:52.797189+00', '2025-09-09 22:54:52.797189+00'),
	('images', 'original/b3', '2025-09-09 22:54:52.956088+00', '2025-09-09 22:54:52.956088+00'),
	('images', 'original/82', '2025-09-09 22:54:53.071499+00', '2025-09-09 22:54:53.071499+00'),
	('images', 'original/cc', '2025-09-09 22:54:53.129047+00', '2025-09-09 22:54:53.129047+00'),
	('images', 'original/ce', '2025-09-09 22:54:53.176993+00', '2025-09-09 22:54:53.176993+00'),
	('images', 'original/ae', '2025-09-09 22:54:53.200959+00', '2025-09-09 22:54:53.200959+00'),
	('images', 'original/e1', '2025-09-09 22:54:53.324855+00', '2025-09-09 22:54:53.324855+00'),
	('images', 'original/25', '2025-09-09 22:54:53.394953+00', '2025-09-09 22:54:53.394953+00'),
	('images', 'original/92', '2025-09-09 22:54:53.393049+00', '2025-09-09 22:54:53.393049+00'),
	('serp-thumbs', 'serp/77374', '2025-08-27 08:35:08.700528+00', '2025-08-27 08:35:08.700528+00'),
	('images', 'original/17', '2025-09-09 22:54:53.448259+00', '2025-09-09 22:54:53.448259+00'),
	('images', 'original/a9', '2025-09-09 22:54:53.459814+00', '2025-09-09 22:54:53.459814+00'),
	('serp-thumbs', 'serp/463ec', '2025-08-27 08:35:08.993147+00', '2025-08-27 08:35:08.993147+00'),
	('serp-thumbs', 'serp/77dfc', '2025-08-27 08:35:09.196261+00', '2025-08-27 08:35:09.196261+00'),
	('serp-thumbs', 'serp/e3637', '2025-08-27 08:35:09.352828+00', '2025-08-27 08:35:09.352828+00'),
	('serp-thumbs', 'serp/a851d', '2025-08-27 08:35:10.232478+00', '2025-08-27 08:35:10.232478+00'),
	('serp-thumbs', 'serp/a2e54', '2025-08-27 08:35:10.302406+00', '2025-08-27 08:35:10.302406+00'),
	('serp-thumbs', 'serp/c6134', '2025-08-27 08:35:11.205844+00', '2025-08-27 08:35:11.205844+00'),
	('images', 'original/dd', '2025-09-09 22:54:54.87975+00', '2025-09-09 22:54:54.87975+00'),
	('serp-thumbs', 'serp/f6ad3', '2025-08-27 08:35:11.556543+00', '2025-08-27 08:35:11.556543+00'),
	('images', 'original/15', '2025-09-09 22:54:54.940618+00', '2025-09-09 22:54:54.940618+00'),
	('images', 'original/0b', '2025-09-09 22:54:54.945685+00', '2025-09-09 22:54:54.945685+00'),
	('images', 'original/98', '2025-09-09 22:54:54.966424+00', '2025-09-09 22:54:54.966424+00'),
	('images', 'original/cd', '2025-09-09 22:54:55.032645+00', '2025-09-09 22:54:55.032645+00'),
	('images', 'original/1f', '2025-09-09 22:54:55.090595+00', '2025-09-09 22:54:55.090595+00'),
	('images', 'original/95', '2025-09-09 22:54:55.236516+00', '2025-09-09 22:54:55.236516+00'),
	('images', 'original/d6', '2025-09-09 22:55:00.083174+00', '2025-09-09 22:55:00.083174+00'),
	('images', 'original/b6', '2025-09-09 22:55:03.391521+00', '2025-09-09 22:55:03.391521+00'),
	('images', 'original/2b', '2025-09-11 19:16:10.27762+00', '2025-09-11 19:16:10.27762+00');


--
-- Data for Name: s3_multipart_uploads; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: s3_multipart_uploads_parts; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: vector_indexes; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- PostgreSQL database dump complete
--

RESET ALL;
