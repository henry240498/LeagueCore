-- LeagueCore - configuración administrable del Login (Seguridad → Configuración del Login).
-- Fila única (id = 1). Los DEFAULT de cada columna son los "valores predeterminados" que usa
-- el endpoint de reset (UPDATE ... SET columna = DEFAULT), así no hay que duplicar los valores
-- por defecto entre la base y el código de la aplicación.

USE LeagueCore;
GO

IF OBJECT_ID('dbo.login_settings', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.login_settings (
        id                      INT NOT NULL PRIMARY KEY CONSTRAINT CK_login_settings_singleton CHECK (id = 1),

        system_name             NVARCHAR(100)  NOT NULL CONSTRAINT DF_ls_system_name DEFAULT N'LeagueCore',
        title                   NVARCHAR(150)  NOT NULL CONSTRAINT DF_ls_title DEFAULT N'LeagueCore',
        subtitle                NVARCHAR(200)  NOT NULL CONSTRAINT DF_ls_subtitle DEFAULT N'Sistema de gestión de ligas y competiciones',
        welcome_message         NVARCHAR(300)  NOT NULL CONSTRAINT DF_ls_welcome DEFAULT N'Accedé para continuar',

        show_logo               BIT            NOT NULL CONSTRAINT DF_ls_show_logo DEFAULT 1,
        show_subtitle           BIT            NOT NULL CONSTRAINT DF_ls_show_subtitle DEFAULT 1,
        show_welcome_message    BIT            NOT NULL CONSTRAINT DF_ls_show_welcome DEFAULT 1,

        logo_main_url           NVARCHAR(500)  NULL,
        logo_login_url          NVARCHAR(500)  NULL,

        background_color        NVARCHAR(20)   NOT NULL CONSTRAINT DF_ls_bg_color DEFAULT N'#0f172a',
        background_image_url    NVARCHAR(500)  NULL,
        background_position     NVARCHAR(30)   NOT NULL CONSTRAINT DF_ls_bg_position DEFAULT N'center',
        background_size         NVARCHAR(30)   NOT NULL CONSTRAINT DF_ls_bg_size DEFAULT N'cover',
        background_repeat       NVARCHAR(30)   NOT NULL CONSTRAINT DF_ls_bg_repeat DEFAULT N'no-repeat',
        overlay_color           NVARCHAR(20)   NOT NULL CONSTRAINT DF_ls_overlay_color DEFAULT N'#000000',
        overlay_opacity         DECIMAL(3,2)   NOT NULL CONSTRAINT DF_ls_overlay_opacity DEFAULT 0.00,

        color_primary           NVARCHAR(20)   NOT NULL CONSTRAINT DF_ls_color_primary DEFAULT N'#2563eb',
        color_secondary         NVARCHAR(20)   NOT NULL CONSTRAINT DF_ls_color_secondary DEFAULT N'#1e293b',
        color_text              NVARCHAR(20)   NOT NULL CONSTRAINT DF_ls_color_text DEFAULT N'#0f172a',
        color_text_secondary    NVARCHAR(20)   NOT NULL CONSTRAINT DF_ls_color_text_secondary DEFAULT N'#64748b',
        color_form_bg           NVARCHAR(20)   NOT NULL CONSTRAINT DF_ls_color_form_bg DEFAULT N'#ffffff',
        color_button            NVARCHAR(20)   NOT NULL CONSTRAINT DF_ls_color_button DEFAULT N'#2563eb',
        color_button_hover      NVARCHAR(20)   NOT NULL CONSTRAINT DF_ls_color_button_hover DEFAULT N'#1d4ed8',
        color_error             NVARCHAR(20)   NOT NULL CONSTRAINT DF_ls_color_error DEFAULT N'#dc2626',
        color_border            NVARCHAR(20)   NOT NULL CONSTRAINT DF_ls_color_border DEFAULT N'#cbd5e1',
        color_input_bg          NVARCHAR(20)   NOT NULL CONSTRAINT DF_ls_color_input_bg DEFAULT N'#ffffff',

        button_text             NVARCHAR(50)   NOT NULL CONSTRAINT DF_ls_button_text DEFAULT N'Iniciar sesión',
        placeholder_username    NVARCHAR(80)   NOT NULL CONSTRAINT DF_ls_ph_username DEFAULT N'Ingresá tu usuario',
        placeholder_password    NVARCHAR(80)   NOT NULL CONSTRAINT DF_ls_ph_password DEFAULT N'Ingresá tu contraseña',

        updated_at              DATETIME2      NOT NULL CONSTRAINT DF_ls_updated_at DEFAULT SYSUTCDATETIME(),
        updated_by              INT            NULL,
        CONSTRAINT FK_login_settings_updated_by FOREIGN KEY (updated_by) REFERENCES dbo.users(id)
    );

    INSERT INTO dbo.login_settings (id) VALUES (1);
END
GO
