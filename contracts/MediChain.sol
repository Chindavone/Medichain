// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// On-chain half of MediChain: who is who, who may see what, and record hashes.
/// No names, diagnoses or medication ever touch this contract (SRS §5, NFR-02).
contract MediChain {
    enum Role { None, Doctor, Nurse, Admin }

    // Scope bits — a grant can cover any combination.
    uint8 public constant CONSULT = 1; // symptoms, diagnosis, medication, plan
    uint8 public constant VITALS = 2;  // BP, pulse, temperature, weight
    uint8 public constant LABS = 4;    // lab results

    struct Grant { uint8 scopes; uint64 expires; }
    struct Anchor { address patient; address author; uint64 at; }

    address public immutable owner;
    mapping(address => Role) public roleOf;
    mapping(bytes32 => address) public patientOf; // keccak256(patientId) => wallet
    mapping(address => bytes32) public idHashOf;
    mapping(address => mapping(address => Grant)) public grants; // patient => grantee
    mapping(bytes32 => Anchor) public anchors;

    event RoleSet(address indexed account, Role role, address indexed by);
    event PatientRegistered(address indexed patient, bytes32 indexed idHash);
    event AccessGranted(address indexed patient, address indexed grantee, uint8 scopes, uint64 expires);
    event AccessRevoked(address indexed patient, address indexed grantee);
    event RecordAnchored(address indexed patient, bytes32 indexed hash, address indexed author);

    constructor() {
        owner = msg.sender;
        roleOf[msg.sender] = Role.Admin;
        emit RoleSet(msg.sender, Role.Admin, msg.sender);
    }

    function setRole(address account, Role role) external {
        require(roleOf[msg.sender] == Role.Admin, "admin only");
        require(account != owner, "owner role is fixed");
        require(idHashOf[account] == 0, "account is a patient");
        require(role != Role.Admin || msg.sender == owner, "owner only for admin");
        roleOf[account] = role;
        emit RoleSet(account, role, msg.sender);
    }

    function registerPatient(bytes32 idHash) external {
        require(idHash != 0, "empty id");
        require(idHashOf[msg.sender] == 0, "already registered");
        require(patientOf[idHash] == address(0), "id taken");
        require(roleOf[msg.sender] == Role.None, "staff cannot be patient");
        patientOf[idHash] = msg.sender;
        idHashOf[msg.sender] = idHash;
        emit PatientRegistered(msg.sender, idHash);
    }

    /// Only the patient can open access to their own book.
    function grantAccess(address grantee, uint8 scopes, uint64 expires) external {
        require(idHashOf[msg.sender] != 0, "not a patient");
        Role r = roleOf[grantee];
        require(r == Role.Doctor || r == Role.Nurse, "grantee is not medical staff");
        require(scopes != 0 && scopes <= 7, "bad scopes");
        require(expires > block.timestamp, "expiry in the past");
        grants[msg.sender][grantee] = Grant(scopes, expires);
        emit AccessGranted(msg.sender, grantee, scopes, expires);
    }

    function revokeAccess(address grantee) external {
        require(grants[msg.sender][grantee].scopes != 0, "no active grant");
        delete grants[msg.sender][grantee];
        emit AccessRevoked(msg.sender, grantee);
    }

    /// True when `who` may read `scope` of `patient`'s book right now.
    function hasAccess(address patient, address who, uint8 scope) public view returns (bool) {
        if (idHashOf[patient] == 0) return false;
        if (who == patient) return true;
        Role r = roleOf[who];
        if (r != Role.Doctor && r != Role.Nurse) return false; // de-registered staff lose access
        Grant memory g = grants[patient][who];
        return scope != 0 && g.scopes & scope == scope && g.expires > block.timestamp;
    }

    /// Staff anchor the hash of a record they wrote. Nurses may only anchor vitals.
    function anchorRecord(address patient, bytes32 hash, uint8 scope) external {
        require(roleOf[msg.sender] == Role.Doctor || (roleOf[msg.sender] == Role.Nurse && scope == VITALS), "role cannot write this");
        require(hasAccess(patient, msg.sender, scope), "no access");
        require(anchors[hash].at == 0, "already anchored");
        anchors[hash] = Anchor(patient, msg.sender, uint64(block.timestamp));
        emit RecordAnchored(patient, hash, msg.sender);
    }
}
