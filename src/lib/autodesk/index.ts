
/**
* Represents a user profile information object.
*/
export type AutodeskUserInformation = {

    /** Oxygen id of the user */
    sub: string;
    
    /** Full name of the user */
    name: string;
    
    /** First name of the user */
    given_name: string;
    
    /** Last name of the user */
    family_name: string;
    
    /** Username of the user */
    preferred_username: string;
    
    /** Primary email of the user */
    email: string;
    
    /** Flag that shows if the user's email is verified or not */
    email_verified: boolean;
    
    /** URL for the profile of the user */
    profile: string;
    
    /** Profile image of the user (x120 thumbnail) */
    picture: string;
    
    /** End-User's locale, represented as a BCP47 standard (eg, en-US) */
    locale: string;
    
    /** The second-precision Unix timestamp of last modification on the user profile */
    updated_at: number;
    
    /** Flag is true if two factor authentication is enabled for this profile. */
    is_2fa_enabled: boolean;
    
    /** The country code assigned to the account at creation. */
    country_code: string;
    
    /** Object containing contact address information */
    address: {
        street_address: string,
        locality: string,
        region: string,
        postal_code: string,
        country: string,
    };
    
    /** The primary phone number of the user profile with country code and extension in the format: "+(countryCode) (phoneNumber) #(Extension)" */
    phone_number: string;
    
    /** Flag to tell whether or not above phone number was verified */
    phone_number_verified: boolean;
    
    /** Flag for the LDAP/SSO Status of the user, true if is ldap user. */
    ldap_enabled: boolean;
    
    /** Domain name for the LDAP user null if non LDAP user */
    ldap_domain: string;
    
    /** The job title selected on the user profile. */
    job_title: string;
    
    /** The industry selected on the user profile. */
    industry: string;
    
    /** The industry code associated on the user profile */
    industry_code: string;
    
    /** The about me text on the user profile */
    about_me: string;
    
    /** The language selected by the user */
    language: string;
    
    /** The company on the user profile */
    company: string;
    
    /** The datetime (UTC) the user was created */
    created_date: string;
    
    /** The last login date (UTC) of the user */
    last_login_date: string;
    
    /** Eidm Identifier. */
    eidm_guid: string;
    
    /** The flag that indicates if user opts in the marketing information. */
    opt_in: boolean;
    
    /** Social provider name and provider identifier when the user is a social user or else empty list. */
    social_userinfo_list: Array<object>;
    
    /** Object with profile image thumbnail urls for each size by key. */
    thumbnails: {
        sizeX20: string,
        sizeX40: string,
        sizeX50: string,
        sizeX58: string,
        sizeX80: string,
        sizeX120: string,
        sizeX160: string,
        sizeX176: string,
        sizeX240: string,
        sizeX360: string,
    };
};

export const AUTODESK_SCOPES = [
    "user-profile:read",
    "user:read",
    "user:write",
    "viewables:read",
    "data:read",
    "data:write",
    "data:create",
    "data:search",
    "bucket:create",
    "bucket:read",
    "bucket:update",
    "bucket:delete",
    "code:all",
    "account:read",
    "account:write",
    "openid",
] as const

export type AutodeskScope = typeof AUTODESK_SCOPES[number]