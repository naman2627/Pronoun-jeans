from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated, BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import CustomUser, Address
from .serializers import (
    B2BTokenObtainPairSerializer, UserSerializer,
    RegisterSerializer, AddressSerializer,
    AgentBuyerSerializer, RequestAccessSerializer,
)


# ── Custom Permissions ────────────────────────────────────────────────────────

class IsAgent(BasePermission):
    """Allows access only to authenticated users with is_agent=True."""
    message = 'Agent access required.'

    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.is_agent
        )


# ── Auth ──────────────────────────────────────────────────────────────────────

class B2BTokenObtainPairView(TokenObtainPairView):
    serializer_class = B2BTokenObtainPairSerializer


# ── Registration ──────────────────────────────────────────────────────────────

class RegisterView(generics.CreateAPIView):
    queryset           = CustomUser.objects.all()
    permission_classes = [AllowAny]
    serializer_class   = RegisterSerializer


# ── Request Access (self-registration with optional agent code) ───────────────

class RequestAccessView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RequestAccessSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        serializer.save()
        return Response(
            {'message': 'Access request submitted. Our team will contact you shortly.'},
            status=status.HTTP_201_CREATED,
        )


# ── Buyer Profile ─────────────────────────────────────────────────────────────

class ProfileView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class   = UserSerializer

    def get_object(self):
        return self.request.user


# ── Addresses ─────────────────────────────────────────────────────────────────

class AddressListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class   = AddressSerializer

    def get_queryset(self):
        return Address.objects.filter(user=self.request.user)

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context


class AddressDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class   = AddressSerializer

    def get_queryset(self):
        return Address.objects.filter(user=self.request.user)


# ── Agent Views ───────────────────────────────────────────────────────────────

class AgentBuyersListView(generics.ListAPIView):
    """Returns all buyers assigned to the currently logged-in agent."""
    permission_classes = [IsAgent]
    serializer_class   = AgentBuyerSerializer

    def get_queryset(self):
        return CustomUser.objects.filter(
            assigned_agent=self.request.user,
            is_verified_b2b=True,
        ).order_by('-date_joined')


class AgentBuyerDetailView(generics.RetrieveAPIView):
    """Returns details of a single buyer assigned to the agent."""
    permission_classes = [IsAgent]
    serializer_class   = AgentBuyerSerializer

    def get_queryset(self):
        return CustomUser.objects.filter(assigned_agent=self.request.user)


class AgentManualOnboardView(APIView):
    """
    Agent manually onboards a new verified B2B buyer.
    Creates the user, sets a random temp password, auto-assigns to this agent.
    """
    permission_classes = [IsAgent]

    def post(self, request):
        email        = request.data.get('email', '').strip().lower()
        first_name   = request.data.get('first_name', '').strip()
        last_name    = request.data.get('last_name', '').strip()
        company_name = request.data.get('company_name', '').strip()
        phone_number = request.data.get('phone_number', '').strip()
        gst_number   = request.data.get('gst_number', '').strip()

        if not email or not company_name or not phone_number:
            return Response(
                {'error': 'Email, company name, and phone number are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if CustomUser.objects.filter(email=email).exists():
            return Response(
                {'error': 'A user with this email already exists.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        temp_password = CustomUser.objects.make_random_password(length=12)

        user = CustomUser(
            email           = email,
            username        = email,
            first_name      = first_name,
            last_name       = last_name,
            company_name    = company_name,
            phone_number    = phone_number,
            gst_number      = gst_number or None,
            is_verified_b2b = True,
            assigned_agent  = request.user,
        )
        user.set_password(temp_password)
        user.save()

        return Response(
            {
                'message':       f'Buyer {email} onboarded successfully.',
                'buyer_id':      user.id,
                'email':         user.email,
                'company_name':  user.company_name,
                'temp_password': temp_password,
            },
            status=status.HTTP_201_CREATED,
        )