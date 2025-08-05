const apiKey = process.env.BUNGIE_API_KEY;
const clientID = "50382";

const tokenUrl = "https://www.bungie.net/Platform/App/OAuth/token/" // Bungie's token endpoint

const urlParams = new URLSearchParams(window.location.search);
const authCode = urlParams.get('code');
const authState = urlParams.get('state');

if (authCode) {
    const storedState = localStorage.getItem('token');
    if (authState != storedState) {
        console.error("State mismatch.");
    } else {
        const requestBody = new URLSearchParams({
            grant_type: "authorization_code",
            code: authCode,
            client_id: clientID,
        });

        fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: requestBody.toString(),
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                console.error("Error fetching token:", data.error_description);
                return;
            }

            console.log("Successfully fetched tokens:", data);
            localStorage.setItem('bungie_access_token', data.access_token);
            localStorage.setItem('bungie_expires_in', data.expires_in);
            localStorage.setItem('bungie_membership_id', data.membership_id);

            fetchProfileData();

            window.history.replaceState(null, null, window.location.pathname);
        })
        .catch(error => {
            console.error("A network error occurred:", error);
        });
    }
}

const loginButton = document.getElementById('login-button');
loginButton.addEventListener('click', () => {
    const randomToken = Math.random().toString(36).substring(2,18); // Generate random key 10 characters long
    localStorage.setItem('token', `${randomToken}`); // Store temporary token
    window.location.href = `https://www.bungie.net/en/oauth/authorize?client_id=${clientID}&response_type=code&state=${randomToken}`;
});

const characterClassRadios = document.querySelectorAll('input[name="character-class"]');
characterClassRadios.forEach((radio) => {
    radio.addEventListener('change', () => {
        if (radio.checked) {
            console.log(`${radio.id}`);
            fetchProfileData();
        }
    })
})

async function fetchProfileData () {
    const accessToken = localStorage.getItem('bungie_access_token');
    const bungieMembershipId = localStorage.getItem('bungie_membership_id');

    if (!accessToken ||  !bungieMembershipId) {
        console.error("Missing credentials in localStorage.");
        return;
    }

    const headers  = {
        "X-API-Key": apiKey,
        "Authorization": `Bearer ${accessToken}`
    };

    try {
        const membershipTypeForAllPlatforms = -1;
        const getMembershipsUrl = `https://www.bungie.net/Platform/User/GetMembershipsById/${bungieMembershipId}/${membershipTypeForAllPlatforms}/`;

        const membershipResponse = await fetch(getMembershipsUrl, { headers: headers });

        // This error check is still important
        if (!membershipResponse.ok) {
            console.error(`GetMembershipsById failed with status: ${membershipResponse.status}`);
            const errorText = await membershipResponse.text();
            console.error("Bungie API Error Response:", errorText);
            return; // This return fixes the "body already read" error
        }

        const membershipData = await membershipResponse.json();

        // This check is important! If the user has no Destiny account, this could be empty.
        if (!membershipData.Response || !membershipData.Response.destinyMemberships || membershipData.Response.destinyMemberships.length === 0) {
            console.error("No Destiny 2 profiles found for this user.");
            return;
        }

        const destinyProfile = membershipData.Response.destinyMemberships[0];
        const membershipType = destinyProfile.membershipType;
        const destinyMembershipId = destinyProfile.membershipId;

        const apiUrl = `https://www.bungie.net/Platform/Destiny2/${membershipType}/Profile/${destinyMembershipId}/?components=102,201,205`;

        const profileResponse = await fetch(apiUrl, { headers: headers });
        const profileData = await profileResponse.json();
        
        console.log("--- Full Profile Response ---");
        console.log(profileData.Response);
    } catch (error) {
        console.error("Error fetching profile data:", error)
    }
}